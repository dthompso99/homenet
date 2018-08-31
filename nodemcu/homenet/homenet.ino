

#include <ESP8266WiFi.h>
#include <WiFiUdp.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>

unsigned int udp_port = 2311;
char incomingPacket[255];
IPAddress server_ip;
int pinModes [NUM_DIGITAL_PINS] = {};
int data [NUM_DIGITAL_PINS] = {};
unsigned long lastTimestamp = 0;
WiFiUDP udp;

void setup() {
  WiFiManager wifiManager;
  Serial.begin(38400);
  wifiManager.autoConnect();

  while ( WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  udp.begin(udp_port);
  server_ip = findServer();
  setupPins();
}

void readUdp() {
  int packetSize = udp.parsePacket();
  if (packetSize) {
    Serial.printf("Received %d bytes from %s, port %d\n", packetSize, udp.remoteIP().toString().c_str(), udp.remotePort());
    int len = udp.read(incomingPacket, 255);
    if (len > 0)
    {
      incomingPacket[len] = 0;
    }
    Serial.printf("UDP packet contents: %s\n", incomingPacket);
    if (getValue(incomingPacket, '|', 0) == "a^set") {
      int pin = getValue(getValue(incomingPacket, '|', 1), '^', 1).toInt();
      int val = getValue(getValue(incomingPacket, '|', 2), '^', 1).toInt();
      if (pinModes[pin] == 2) {
        data[pin] = val;
        pinMode(pin, OUTPUT);
        if (val == 1) {
          digitalWrite(pin, HIGH);
        } else {
          digitalWrite(pin, LOW);
        }
        Serial.print("Set pin ");
        Serial.print(pin);
        Serial.print(" to ");
        Serial.println(val);
      } else {
        Serial.println("Pin is not configured for output");
      }
    } else if (getValue(incomingPacket, '|', 0) == "a^reboot") {
      ESP.reset();
    }
  }
}

IPAddress findServer() {
  bool found = false;
  IPAddress serverIp;
  IPAddress broadcastIp = WiFi.localIP();
  broadcastIp[3] = 255;
  Serial.println(broadcastIp);
  udp.beginPacket(broadcastIp, udp_port);
  udp.print("a^register");
  udp.print("|mac^");
  udp.print(WiFi.macAddress());
  udp.print("|ip^");
  udp.print(WiFi.localIP());
  udp.print("|digital^");
  udp.print(NUM_DIGITAL_PINS);
  udp.print("|analog^");
  udp.print(NUM_ANALOG_INPUTS);
  udp.endPacket();
  while (!found) {
    int packetSize = udp.parsePacket();
    if (packetSize) {
      Serial.printf("Received %d bytes from %s, port %d\n", packetSize, udp.remoteIP().toString().c_str(), udp.remotePort());
      int len = udp.read(incomingPacket, 255);
      if (len > 0)
      {
        incomingPacket[len] = 0;
      }
      if (getValue(incomingPacket, '|', 0) == "a^register") {
        String serverStr = getValue(getValue(incomingPacket, '|', 1), '^', 1);
        Serial.printf("UDP packet contents: %s  :  %s \n ", incomingPacket, serverStr.c_str());
        if (serverIp.fromString(serverStr)) {
          int numPins = getValue(getValue(incomingPacket, '|', 2), '^', 1).toInt();
          for (int i = 0; i < numPins; i++) {
            String chunk = getValue(incomingPacket, '|', 3 + i);
            int apin = getKey(chunk).toInt();
            int amode = getValue(chunk, '^', 1).toInt();
            pinModes[apin] = amode;
          }
          return parseIP(serverStr);
        }
        found = true;
      }

    }
  }

  return broadcastIp;
}

void reRegister() {

}

void setupPins() {
  Serial.println("Setting Up Pins");
  for (int i = 0; i < NUM_DIGITAL_PINS; i++) {
    if (pinModes[i] > 0 && pinModes[i] <= 3) {
      if (pinModes[i] == 1) {
        pinMode(pinModes[i], INPUT);
        data[i] = digitalRead(i);
      } else if (pinModes[i] == 2) {
        pinMode(pinModes[i], OUTPUT);
        digitalWrite(pinModes[i], LOW);
        data[i] = 1;
      } else if (pinModes[i] == 3) {
        pinMode(pinModes[i], INPUT_PULLUP);
        data[i] = digitalRead(i);
      }
    }
  }
}

IPAddress parseIP(String data) {
  int Parts[4] = {0, 0, 0, 0};
  int Part = 0;
  for ( int i = 0; i < data.length(); i++ )
  {
    char c = data[i];
    if ( c == '.' )
    {
      Part++;
      continue;
    }
    Parts[Part] *= 10;
    Parts[Part] += c - '0';
  }
  return  IPAddress( Parts[0], Parts[1], Parts[2], Parts[3] );
}

String getValue(String data, char separator, int index)
{
  int found = 0;
  int strIndex[] = {0, -1};
  int maxIndex = data.length() - 1;

  for (int i = 0; i <= maxIndex && found <= index; i++) {
    if (data.charAt(i) == separator || i == maxIndex) {
      found++;
      strIndex[0] = strIndex[1] + 1;
      strIndex[1] = (i == maxIndex) ? i + 1 : i;
    }
  }

  return found > index ? data.substring(strIndex[0], strIndex[1]) : "";
}

String getKey(String data) {
  int maxIndex = data.length() - 1;
  for (int i = 0; i <= maxIndex; i++) {
    if (data.charAt(i) == '^') {
      return data.substring(0, i);
    }
  }
  return "";
}

void pinChange(int pin, int val) {
  Serial.print("Pin Change: ");
  Serial.print(pin);
  Serial.print(":");
  Serial.println(val);
  udp.beginPacket(server_ip, udp_port);
  udp.print("a^pinchange");
  udp.print("|d^");
  udp.print(WiFi.macAddress());
  udp.print("|pin^");
  udp.print(pin);
  udp.print("|state^");
  udp.print(val);
  udp.endPacket();
}

void loop() {
  unsigned long now = millis();
  for (int i = 0; i < NUM_DIGITAL_PINS; i++) {
    if (pinModes[i] == 1 || pinModes[i] == 3) {
      int v = digitalRead(i);
      if (data[i] != v) {
        data[i] = v;
        pinChange(i, v);
      }
    }
  }
  //check for input
  readUdp();
  unsigned long diff = now - lastTimestamp;
  if (abs(diff) >= 300000) {
    lastTimestamp = now;
    IPAddress old_server_ip = server_ip;
    if (findServer() != server_ip) {
      ESP.reset();
    }
  }
}
