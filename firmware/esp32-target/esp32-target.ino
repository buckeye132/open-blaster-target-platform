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
enum TargetState { IDLE, READY, DISPLAYING, HIT_ANIMATION };
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
int piezoThreshold = 150;
int currentHitCount = 0;
String activeValue = "";
String activeHitConfigId = "";
unsigned long targetReadyTime = 0;
unsigned long timeoutExpireTime = 0;
String commandBuffer = ""; // Using String for simplicity with corrected parsing

// --- Visual Script Executor Variables ---
std::vector<VisualStep> activeScript;
int currentStepIndex = 0;
unsigned long stepStartTime = 0;
int loopCount = 0;
bool isLooping = false;

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

  WiFi.begin(ssid, password);
  Serial.print("LOG: Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nLOG: WiFi connected!");
  Serial.print("LOG: My IP: "); Serial.println(WiFi.localIP());
  Serial.println("LOG: Target is IDLE.");
  Serial.println("LOG: --- Setup Complete ---");
}

void loop() {
  // --- Heartbeat LED (disabled due to pin conflict with DATA_PIN on GPIO2) ---
  // uint8_t brightness = beatsin8(10, 0, 80);
  // analogWrite(ONBOARD_LED, brightness);

  // --- TCP Connection Management ---
  if (!tcpClient.connected()) {
    if (millis() - lastConnectionAttempt > 5000) {
      connectToPrimary();
      lastConnectionAttempt = millis();
    }
  } else {
    // --- Non-Blocking Command Receiver ---
    if (tcpClient.available()) {
        while (tcpClient.available()) {
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
    }
  }

  // --- State Machine ---
  uint16_t piezo_read = analogRead(PIEZO_PIN);
  if (piezo_read > 0) {
    Serial.printf("LOG: PIEZO: %u\n", piezo_read);
  }
  if (currentState == READY) {
    if (piezo_read > piezoThreshold) {
      Serial.println("LOG: Hit detected in READY state.");
      currentHitCount++;
      unsigned long reaction = millis() - targetReadyTime;
      
      HitConfig& config = hitConfigs[activeHitConfigId];
      
      if (currentHitCount >= config.hitsRequired) {
        Serial.printf("LOG: Final hit detected! Sending HIT %lu %s\n", reaction, activeValue.c_str());
        tcpClient.printf("HIT %lu %s\n", reaction, activeValue.c_str());
        currentState = HIT_ANIMATION;
        startVisualScript(config.script, 1);
      } else {
        Serial.println("LOG: Interim hit detected.");
        if (interimHitConfigs.count(activeHitConfigId)) {
            Serial.println("LOG: Playing interim hit animation.");
            startVisualScript(interimHitConfigs[activeHitConfigId], 1);
        }
      }
    }
    if (timeoutExpireTime > 0 && millis() > timeoutExpireTime) {
        Serial.printf("LOG: Target expired. Sending EXPIRED %s\n", activeValue.c_str());
        tcpClient.printf("EXPIRED %s\n", activeValue.c_str());
        stopAllActions();
    }
  }

  // --- Visuals Update ---
  updateVisuals();

  delay(1);
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
        if (parts.size() < 4) continue;

        step.duration = parts[0].toInt();
        step.state.type = parts[1];
        if (step.state.type == "SOLID" && parts.size() >= 5) {
            step.state.color = CRGB(parts[2].toInt(), parts[3].toInt(), parts[4].toInt());
        } else if (step.state.type == "ANIM" && parts.size() >= 6) {
            step.state.animName = parts[2];
            step.state.color = CRGB(parts[3].toInt(), parts[4].toInt(), parts[5].toInt());
        }
        script.push_back(step);
    }
    return script;
}

void parseAndExecuteCommand(String command) {
  Serial.println("LOG: Entering parseAndExecuteCommand.");
  command.trim();
  if (command == "") return;
  currentCommand = command;

  auto tokens = splitString(command, ' ');
  String cmdType = tokens[0];

  if (cmdType == "CONFIG_THRESHOLD") {
    piezoThreshold = tokens[1].toInt();
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
    tcpClient.printf("STATUS_REPORT %s %s\n", stateStr.c_str(), currentCommand.c_str());
  }
}

void startVisualScript(const std::vector<VisualStep>& script, int loops) {
    Serial.println("LOG: Entering startVisualScript.");
    if (script.empty()) {
        Serial.println("LOG: Script is empty, stopping actions.");
        stopAllActions();
        return;
    }
    activeScript = script;
    currentStepIndex = 0;
    stepStartTime = millis();
    loopCount = loops;
    isLooping = (loops == 0);
    Serial.printf("LOG: Starting script with %d loops.\n", loops);
    renderFrame();
}

void stopAllActions() {
    Serial.println("LOG: Entering stopAllActions. Setting state to IDLE.");
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
    //Serial.println("LOG: Entering renderFrame.");
    if (activeScript.empty()) {
        Serial.println("LOG: renderFrame - activeScript is empty, returning.");
        return;
    }

    const VisualStep& currentStep = activeScript[currentStepIndex];
    //Serial.println("LOG: renderFrame - Rendering step " + String(currentStepIndex) + " of type " + currentStep.state.type);
    
    int ledsToShow = NUM_LEDS;
    if (currentState == READY && hitConfigs.count(activeHitConfigId) && hitConfigs[activeHitConfigId].healthBarMode == 1) {
        int hitsReq = hitConfigs[activeHitConfigId].hitsRequired;
        ledsToShow = map(hitsReq - currentHitCount, 0, hitsReq, 0, NUM_LEDS);
        //Serial.println("LOG: renderFrame - Health bar mode active, showing " + String(ledsToShow) + " LEDs.");
    }

    if (currentStep.state.type == "SOLID") {
        for (int i = 0; i < NUM_LEDS; i++) {
            leds[i] = (i < ledsToShow) ? currentStep.state.color : CRGB::Black;
        }
    } else if (currentStep.state.type == "ANIM") {
        if (currentStep.state.animName == "PULSE") {
            uint8_t brightness = beatsin8(20, 64, 255);
            CRGB color = currentStep.state.color;
            color.nscale8(brightness);
            for (int i = 0; i < ledsToShow; i++) leds[i] = color;
            for (int i = ledsToShow; i < NUM_LEDS; i++) leds[i] = CRGB::Black;
        } else if (currentStep.state.animName == "THEATER_CHASE") {
            static uint8_t chaseOffset = 0;
            chaseOffset++;
            for (int i = 0; i < NUM_LEDS; i++) {
                if ((i + chaseOffset) % 3 == 0 && i < ledsToShow) {
                    leds[i] = currentStep.state.color;
                } else {
                    leds[i] = CRGB::Black;
                }
            }
        }
    }
    FastLED.show();
    //Serial.println("LOG: renderFrame - FastLED.show() called.");
}

void updateVisuals() {
    if (activeScript.empty()) {
        if (currentState == DISPLAYING || currentState == HIT_ANIMATION) {
            stopAllActions();
        }
        return;
    }

    if (millis() - lastLedUpdateTime < ledUpdateInterval) {
        return;
    }
    lastLedUpdateTime = millis();

    if (millis() - stepStartTime >= activeScript[currentStepIndex].duration) {
        Serial.println("LOG: updateVisuals - Step " + String(currentStepIndex) + " duration has ended.");
        currentStepIndex++;
        stepStartTime = millis();
        if (currentStepIndex >= activeScript.size()) {
            Serial.println("LOG: updateVisuals - End of script sequence reached.");
            if (isLooping) {
                Serial.println("LOG: updateVisuals - Looping script.");
                currentStepIndex = 0;
            } else {
                loopCount--;
                if (loopCount > 0) {
                    Serial.println("LOG: updateVisuals - Repeating script. Loops remaining: " + String(loopCount));
                    currentStepIndex = 0;
                } else {
                    Serial.println("LOG: updateVisuals - Script finished, clearing activeScript.");
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
  } else {
    Serial.println("LOG: Connection failed.");
  }
}