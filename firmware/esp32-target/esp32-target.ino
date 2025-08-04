/*
 * Copyright 2025 https://github.com/buckeye132
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <WiFi.h>
#include <FastLED.h>
#include <vector>
#include <map>
#include "credentials.h" // Local WiFi credentials

// --- Core Configuration ---
#define NUM_LEDS 34
#define DATA_PIN 2
#define PIEZO_PIN 34
#define ONBOARD_LED 2 // Built-in LED for heartbeat
#define COMMAND_BUFFER_SIZE 256 // Max command length
#define LED_UPDATE_FPS 60 // Max frames per second for LED updates

// --- WiFi & Server Credentials ---
// Credentials are load from the local "credentials.h" file.

// --- Global Objects ---
WiFiClient tcpClient;
CRGB leds[NUM_LEDS];

// --- State Management ---
enum TargetState { IDLE, READY, DISPLAYING, HIT_ANIMATION, HIT_DEBOUNCE };
TargetState currentState = IDLE;
String currentCommand = ""; // For status reporting

// --- Visual Script Structures ---
struct VisualState {
  String type; // "SOLID" or "ANIM"
  String animName;
  CRGB color;
};

struct VisualStep {
  unsigned long duration;
  VisualState state;
};

// --- Hit Configuration Structures ---
struct HitConfig {
  int hitsRequired = 1;
  int healthBarMode = 0; // 0=NONE, 1=DECREMENTAL
  std::vector<VisualStep> script;
};

// --- Maps to Store Configurations ---
std::map<String, HitConfig> hitConfigs;
std::map<String, std::vector<VisualStep>> interimHitConfigs;

// --- Target & Game Variables ---
String responseBuffer = "";
bool timingDebugMode = false;
int piezoThreshold = 500;
int currentHitCount = 0;
String activeValue = "";
String activeHitConfigId = "";
unsigned long targetReadyTime = 0;
unsigned long timeoutExpireTime = 0;
String commandBuffer = ""; // Using String for simplicity with corrected parsing

// --- Hit Debounce & Debug Variables ---
int lastPeakReading = 0;
int debounceReadings = 0;
unsigned long debounceStartTime = 0;
bool postHitDebugEnabled = false;
unsigned long postHitDebugEndTime = 0;

// --- Visual Script Executor Variables ---
std::vector<VisualStep> activeScript;
int currentStepIndex = 0;
unsigned long stepStartTime = 0;
int loopCount = 0;
bool isLooping = false;

// --- Animation State Variables ---
static uint8_t animationCounter = 0;
static uint8_t animationHue = 0;
static int cometPosition = 0;
static int wipePosition = 0;
static int cylonPosition = 0;
static bool cylonDirection = 0; // 0 for forward, 1 for backward

// --- Non-Blocking Timers ---
unsigned long lastConnectionAttempt = 0;
unsigned long lastLedUpdateTime = 0;
const unsigned long ledUpdateInterval = 1000 / LED_UPDATE_FPS;

// --- Function Declarations ---
void connectToPrimary();
void parseAndExecuteCommand(String command);
void startVisualScript(const std::vector<VisualStep>& script, int loops);
void updateVisuals();
void stopAllActions();
void renderFrame();
void autoCalibratePiezoThreshold();

void setup() {
  Serial.begin(115200);
  Serial.println("\n\nLOG: --- Target Booting Up ---");
  randomSeed(analogRead(0));
  pinMode(ONBOARD_LED, OUTPUT);

  FastLED.addLeds<WS2812B, DATA_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(150);
  FastLED.clear();
  FastLED.show();
  Serial.println("LOG: FastLED initialized.");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("LOG: Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  WiFi.setSleep(false);
  Serial.println("\nLOG: WiFi connected!");
  Serial.print("LOG: My IP: "); Serial.println(WiFi.localIP());
  Serial.println("LOG: Target is IDLE.");
  Serial.println("LOG: --- Setup Complete ---");
}

void loop() {
  unsigned long loopStart = micros();
  unsigned long networkReadTime = 0, networkWriteTime = 0, stateMachineTime = 0, visualUpdateTime = 0;

  // --- TCP Connection Management ---
  if (!tcpClient.connected()) {
    if (millis() - lastConnectionAttempt > 5000) {
      connectToPrimary();
      lastConnectionAttempt = millis();
    }
  } else {
    // --- Non-Blocking Command Receiver ---
    unsigned long networkReadStart = micros();
    if (tcpClient.available()) {
      char c = tcpClient.read();
      if (c == '\n') {
        commandBuffer.trim();
        if (commandBuffer.length() > 0) {
          parseAndExecuteCommand(commandBuffer);
        }
        commandBuffer = "";
      } else if (c != '\r') {
        commandBuffer += c;
      }
    }
    networkReadTime = micros() - networkReadStart;

    // --- Non-Blocking Response Sender ---
    unsigned long networkWriteStart = micros();
    if (responseBuffer.length() > 0) {
        size_t sent = tcpClient.write(responseBuffer.c_str(), responseBuffer.length());
        responseBuffer.remove(0, sent);
    }
    networkWriteTime = micros() - networkWriteStart;
  }

  // --- State Machine ---
  unsigned long stateMachineStart = micros();
  uint16_t piezo_read = analogRead(PIEZO_PIN);

  // --- High-Frequency Post-Hit Debug Logic ---
  if (postHitDebugEndTime > 0 && millis() < postHitDebugEndTime) {
    Serial.printf("POST_HIT_DEBUG: %u\n", piezo_read);
  } else if (postHitDebugEndTime > 0 && millis() >= postHitDebugEndTime) {
    postHitDebugEndTime = 0; // Stop logging
    Serial.println("LOG: Post-hit debug logging finished.");
  }

  if (currentState == READY) {
    if (piezo_read > piezoThreshold) {
      Serial.printf("LOG: Hit detected! Reading: %u, Threshold: %u\n", piezo_read, piezoThreshold);
      lastPeakReading = piezo_read;
      currentHitCount++;
      unsigned long reaction = millis() - targetReadyTime;
      
      HitConfig& config = hitConfigs[activeHitConfigId];
      Serial.printf("LOG: Hit count is now %d of %d required.\n", currentHitCount, config.hitsRequired);
      
      if (postHitDebugEnabled) {
        postHitDebugEndTime = millis() + 100; // Log for 100ms after the hit
      }

      if (currentHitCount >= config.hitsRequired) {
        char buffer[128];
        snprintf(buffer, sizeof(buffer), "HIT %lu %s\n", reaction, activeValue.c_str());
        responseBuffer += buffer;
        Serial.println("LOG: Final hit registered. Changing state to HIT_ANIMATION.");
        currentState = HIT_ANIMATION;
        startVisualScript(config.script, 1);
      } else {
        Serial.println("LOG: Interim hit registered. Changing state to HIT_DEBOUNCE.");
        debounceReadings = 0; // Reset the counter for the new debounce cycle
        debounceStartTime = millis(); // Record the start time
        currentState = HIT_DEBOUNCE;
        if (interimHitConfigs.count(activeHitConfigId)) {
            Serial.println("LOG: Playing interim hit animation.");
            startVisualScript(interimHitConfigs[activeHitConfigId], 1);
        }
      }
    }
    if (timeoutExpireTime > 0 && millis() > timeoutExpireTime) {
        char buffer[128];
        snprintf(buffer, sizeof(buffer), "EXPIRED %s\n", activeValue.c_str());
        responseBuffer += buffer;
        Serial.println("LOG: Target expired. Stopping all actions.");
        stopAllActions();
    }
  } else if (currentState == HIT_DEBOUNCE) {
      uint16_t troughValue = lastPeakReading * 0.5;
      if (timingDebugMode) Serial.printf("DEBUG: In debounce. Reading: %u, Trough Target: %u, Consecutive Readings: %d\n", piezo_read, troughValue, debounceReadings);
      
      if (piezo_read < troughValue) {
          debounceReadings++;
      } else {
          debounceReadings = 0; // Reset if we go above the trough
      }

      if (debounceReadings >= 3) {
          unsigned long debounceDuration = millis() - debounceStartTime;
          Serial.printf("LOG: Debounce complete after %lu ms. Changing state to READY.\n", debounceDuration);
          currentState = READY;
      }
  }
  stateMachineTime = micros() - stateMachineStart;

  // --- Visuals Update ---
  unsigned long visualUpdateStart = micros();
  updateVisuals();
  visualUpdateTime = micros() - visualUpdateStart;

  if (timingDebugMode) {
    unsigned long loopTime = micros() - loopStart;
    Serial.printf("DEBUG: Loop: %lu us | Read: %lu us | Write: %lu us | State: %lu us | Visuals: %lu us\n", 
                  loopTime, networkReadTime, networkWriteTime, stateMachineTime, visualUpdateTime);
  }
}

// --- Core Logic ---

std::vector<String> splitString(const String& s, char delimiter) {
    std::vector<String> tokens;
    String token;
    for (char c : s) {
        if (c == delimiter) {
            if (token.length() > 0) tokens.push_back(token);
            token = "";
        } else {
            token += c;
        }
    }
    if (token.length() > 0) tokens.push_back(token);
    return tokens;
}

std::vector<VisualStep> parseVisualScript(const std::vector<String>& tokens, int startIndex) {
    std::vector<VisualStep> script;
    String scriptStr = "";
    for(size_t i = startIndex; i < tokens.size(); i++) {
        scriptStr += tokens[i] + " ";
    }
    scriptStr.trim();

    auto stepsStr = splitString(scriptStr, '|');
    for (auto stepStr : stepsStr) {
        stepStr.trim();
        if (stepStr.length() == 0) continue;

        VisualStep step;
        auto parts = splitString(stepStr, ' ');
        if (parts.size() < 3) continue; // Min parts for ANIM: duration, type, name

        step.duration = parts[0].toInt();
        step.state.type = parts[1];

        if (step.state.type == "SOLID" && parts.size() >= 5) {
            step.state.color = CRGB(parts[2].toInt(), parts[3].toInt(), parts[4].toInt());
            script.push_back(step);
        } else if (step.state.type == "ANIM") {
            step.state.animName = parts[2];
            if (parts.size() >= 6) {
                step.state.color = CRGB(parts[3].toInt(), parts[4].toInt(), parts[5].toInt());
            }
            script.push_back(step);
        }
    }
    return script;
}

void parseAndExecuteCommand(String command) {
  command.trim();
  if (command == "") return;
  currentCommand = command;

  auto tokens = splitString(command, ' ');
  String cmdType = tokens[0];

  if (cmdType == "CONFIG_THRESHOLD") {
    if (tokens.size() > 1) {
      piezoThreshold = tokens[1].toInt();
      char buffer[128];
      snprintf(buffer, sizeof(buffer), "LOG: Piezo threshold set to %d\n", piezoThreshold);
      Serial.print(buffer);
      responseBuffer += buffer;
    } else {
      autoCalibratePiezoThreshold();
    }
  }
  else if (cmdType == "CONFIG_HIT") {
    String id = tokens[1];
    hitConfigs[id].hitsRequired = tokens[2].toInt();
    hitConfigs[id].healthBarMode = (tokens[3] == "DECREMENTAL") ? 1 : 0;
    hitConfigs[id].script = parseVisualScript(tokens, 4);
  }
  else if (cmdType == "CONFIG_INTERIM_HIT") {
    String id = tokens[1];
    interimHitConfigs[id] = parseVisualScript(tokens, 2);
  }
  else if (cmdType == "ON") {
    stopAllActions();
    timeoutExpireTime = (tokens[1].toInt() > 0) ? millis() + tokens[1].toInt() : 0;
    activeValue = tokens[2];
    activeHitConfigId = tokens[3];
    currentHitCount = 0;
    targetReadyTime = millis();
    currentState = READY;
    startVisualScript(parseVisualScript(tokens, 4), 0);
  }
  else if (cmdType == "DISPLAY") {
    stopAllActions();
    currentState = DISPLAYING;
    startVisualScript(parseVisualScript(tokens, 2), tokens[1].toInt());
  }
  else if (cmdType == "OFF") {
    stopAllActions();
  }
  else if (cmdType == "STATUS_REQUEST") {
    String stateStr = "IDLE";
    if(currentState == READY) stateStr = "READY";
    if(currentState == DISPLAYING) stateStr = "DISPLAYING";
    if(currentState == HIT_ANIMATION) stateStr = "HIT_ANIMATION";
    char buffer[256];
    snprintf(buffer, sizeof(buffer), "STATUS_REPORT %s %s\n", stateStr.c_str(), currentCommand.c_str());
    responseBuffer += buffer;
  }
  else if (cmdType == "PING") {
    responseBuffer += "PONG\n";
  }
  else if (cmdType == "TIMING_DEBUG") {
    timingDebugMode = !timingDebugMode;
    char buffer[64];
    snprintf(buffer, sizeof(buffer), "LOG Timing debug mode is now %s\n", timingDebugMode ? "ON" : "OFF");
    responseBuffer += buffer;
  }
  else if (cmdType == "POST_HIT_DEBUG") {
    postHitDebugEnabled = !postHitDebugEnabled;
    char buffer[64];
    snprintf(buffer, sizeof(buffer), "LOG: Post-hit debug logging is now %s\n", postHitDebugEnabled ? "ON" : "OFF");
    responseBuffer += buffer;
  }
}

void startVisualScript(const std::vector<VisualStep>& script, int loops) {
    if (script.empty()) {
        // If we are in the debounce state, we must return to ready, not idle.
        if (currentState == HIT_DEBOUNCE) {
            currentState = READY;
        } else {
            stopAllActions();
        }
        return;
    }
    activeScript = script;
    currentStepIndex = 0;
    stepStartTime = millis();
    loopCount = loops;
    isLooping = (loops == 0);

    // --- Reset all animation state variables ---
    animationCounter = 0;
    animationHue = 0;
    cometPosition = 0;
    wipePosition = 0;
    cylonPosition = 0;
    cylonDirection = 0;

    renderFrame();
}

void stopAllActions() {
    currentState = IDLE;
    currentCommand = "OFF";
    activeScript.clear();
    currentStepIndex = 0;
    loopCount = 0;
    isLooping = false;
    FastLED.clear();
    FastLED.show();
}

void renderFrame() {
    if (activeScript.empty()) {
        return;
    }

    const VisualStep& currentStep = activeScript[currentStepIndex];
    int ledsToShow = NUM_LEDS;

    if (currentState == READY && hitConfigs.count(activeHitConfigId) && hitConfigs[activeHitConfigId].healthBarMode == 1) {
        int hitsReq = hitConfigs[activeHitConfigId].hitsRequired;
        if (hitsReq > 0) {
            ledsToShow = map(hitsReq - currentHitCount, 0, hitsReq, 0, NUM_LEDS);
        }
    }

    // --- Animation Logic ---
    if (currentStep.state.type == "SOLID") {
        for (int i = 0; i < ledsToShow; i++) leds[i] = currentStep.state.color;
        for (int i = ledsToShow; i < NUM_LEDS; i++) leds[i] = CRGB::Black;

    } else if (currentStep.state.type == "ANIM") {
        const String& animName = currentStep.state.animName;
        CRGB color = currentStep.state.color;
        
        if (animName == "PULSE") {
            uint8_t brightness = beatsin8(20, 64, 255);
            CRGB pulseColor = color;
            pulseColor.nscale8(brightness);
            for (int i = 0; i < ledsToShow; i++) leds[i] = pulseColor;
        } 
        else if (animName == "THEATER_CHASE") {
            animationCounter++;
            for (int i = 0; i < ledsToShow; i++) {
                leds[i] = ((i + animationCounter) % 3 == 0) ? color : CRGB::Black;
            }
        }
        else if (animName == "RAINBOW_CYCLE") {
            animationHue++;
            // Manual implementation of a rainbow cycle
            for (int i = 0; i < ledsToShow; i++) {
                leds[i] = CHSV((uint8_t)(animationHue + (i * 10)), 255, 255);
            }
        }
        else if (animName == "COMET") {
            const int tailLength = 5;
            fadeToBlackBy(leds, NUM_LEDS, 20); // Fade all LEDs to create the tail
            leds[cometPosition] = color;
            cometPosition = (cometPosition + 1) % NUM_LEDS;
        }
        else if (animName == "WIPE") {
            if (wipePosition < ledsToShow) { // Check bounds BEFORE writing
                leds[wipePosition] = color;
            }
            wipePosition++;

            // After a 0.5s pause (30 frames)
            if (wipePosition >= ledsToShow + (LED_UPDATE_FPS / 2)) {
                wipePosition = 0; // Reset for next loop
                fill_solid(leds, NUM_LEDS, CRGB::Black); // Clear LEDs
            }
        }
        else if (animName == "CYLON") {
            const int eyeSize = 4;
            fadeToBlackBy(leds, NUM_LEDS, 10);
            
            // Move the eye position back and forth across the entire strip
            if (cylonDirection) { // Moving backwards
                cylonPosition--;
                if (cylonPosition <= 0) {
                    cylonPosition = 0;
                    cylonDirection = false;
                }
            } else { // Moving forwards
                cylonPosition++;
                if (cylonPosition >= NUM_LEDS - eyeSize) {
                    cylonPosition = NUM_LEDS - eyeSize;
                    cylonDirection = true;
                }
            }
            
            // Draw the eye at the new position
            for(int i = 0; i < eyeSize; i++) {
                leds[cylonPosition + i] = color;
            }
        }
        else if (animName == "SPARKLE") {
            if (random8() < 120) { // Adjust probability for more/less sparkle
                leds[random16(ledsToShow)] = color;
            }
            fadeToBlackBy(leds, NUM_LEDS, 40);
        }
        else if (animName == "FIRE") {
            const int cooling = 55;
            const int sparking = 120;
            static byte heat[NUM_LEDS];
            
            for( int i = 0; i < NUM_LEDS; i++) {
              heat[i] = qsub8( heat[i],  random8(0, ((cooling * 10) / NUM_LEDS) + 2));
            }
          
            for( int k= NUM_LEDS - 1; k >= 2; k--) {
              heat[k] = (heat[k - 1] + heat[k - 2] + heat[k - 2] ) / 3;
            }
            
            if( random8() < sparking ) {
              int y = random16(NUM_LEDS);
              heat[y] = qadd8( heat[y], random8(160,255) );
            }

            for( int j = 0; j < ledsToShow; j++) {
              CRGB fireColor = HeatColor( heat[j]);
              leds[j] = fireColor;
            }
        }
        else if (animName == "CONVERGE") {
            animationCounter++;
            int midPoint = NUM_LEDS / 2;
            int pos1 = animationCounter % midPoint;
            int pos2 = NUM_LEDS - 1 - pos1;
            
            fill_solid(leds, NUM_LEDS, CRGB::Black);
            leds[pos1] = color;
            leds[pos2] = color;
        }

        // Ensure LEDs outside the health bar are off
        if (ledsToShow < NUM_LEDS) {
            for (int i = ledsToShow; i < NUM_LEDS; i++) {
                leds[i] = CRGB::Black;
            }
        }
    }
    FastLED.show();
}

void autoCalibratePiezoThreshold() {
  Serial.println("LOG: Starting piezo auto-calibration.");
  responseBuffer += "LOG: Starting piezo auto-calibration.\n";

  uint16_t maxPiezoReading = 0;
  uint8_t animCounter = 0;

  // Run animation for 600ms total.
  // Ignore readings for the first 100ms (warm-up).
  unsigned long startTime = millis();
  while (millis() - startTime < 600) {
    animCounter++;
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = ((i + animCounter) % 3 == 0) ? CRGB::White : CRGB::Black;
    }
    FastLED.show();
    
    uint16_t currentReading = analogRead(PIEZO_PIN);
    if (currentReading > maxPiezoReading) {
      maxPiezoReading = currentReading;
    }
    
    delay(10); 
  }

  // Turn LEDs off
  FastLED.clear();
  FastLED.show();

  // continue to read for another 500ms until LED draw settles
  startTime = millis();
  while (millis() - startTime < 500) {
    uint16_t currentReading = analogRead(PIEZO_PIN);
    if (currentReading > maxPiezoReading) {
      maxPiezoReading = currentReading;
    }
    
    delay(10); 
  }

  // Set threshold to 2x above the max noise reading
  // use 850 as the min threshold. 
  piezoThreshold = max(850, (int)(maxPiezoReading * 2));

  char buffer[128];
  snprintf(buffer, sizeof(buffer), "LOG: Auto-calibration complete. Max noise: %d, New threshold: %d\n", maxPiezoReading, piezoThreshold);
  Serial.print(buffer);
  responseBuffer += buffer;
}

void updateVisuals() {
    if (activeScript.empty()) {
        if (currentState == DISPLAYING || currentState == HIT_ANIMATION) {
            stopAllActions();
        }
        // NOTE: We no longer automatically transition from HIT_DEBOUNCE to READY here.
        // That transition is now handled exclusively in the main loop based on the sensor reading.
        return;
    }

    if (millis() - lastLedUpdateTime < ledUpdateInterval) {
        return;
    }
    lastLedUpdateTime = millis();

    if (millis() - stepStartTime >= activeScript[currentStepIndex].duration) {
        currentStepIndex++;
        stepStartTime = millis();
        if (currentStepIndex >= activeScript.size()) {
            if (isLooping) {
                currentStepIndex = 0;
            } else {
                loopCount--;
                if (loopCount > 0) {
                    currentStepIndex = 0;
                } else {
                    activeScript.clear();
                    return;
                }
            }
        }
    }
    
    renderFrame();
}


// --- Networking ---

void connectToPrimary() {
  Serial.print("LOG: Connecting to primary server at "); Serial.println(primaryServerIp);
  if (tcpClient.connect(primaryServerIp, 8888)) {
    Serial.println("LOG: Connected!");
    tcpClient.setNoDelay(true); // Disable Nagle's algorithm for low latency
  } else {
    Serial.println("LOG: Connection failed.");
  }
}