# ENV.MONITOR — Real Time IoT Environmental Dashboard

Live Demo https://one-env-monitor.vercel.app

ENV.MONITOR is a full stack IoT project that monitors environmental conditions in real time using sensors and displays the data on a web dashboard. The system connects an ESP8266 with cloud services and a Next.js frontend to provide continuous updates that can be viewed from anywhere.

## Features

* Real time monitoring using MQTT
* Temperature and humidity tracking using DHT11
* Air quality monitoring using MQ 135
* Live dashboard with automatic updates
* Indoor and outdoor data comparison using free APIs
* Simple and responsive user interface
* Secure connection using MQTT over TLS

## System Overview

The ESP8266 collects sensor data every few seconds and sends it to an MQTT broker. The web dashboard subscribes to the same topic and updates the values instantly when new data is received.

ESP8266 sends data → MQTT broker receives → Web dashboard displays

## Tech Stack

Hardware
ESP8266 NodeMCU
DHT11 Sensor
MQ 135 Sensor
OLED Display

Software
Next.js 14
React
MQTT.js
HiveMQ Cloud

Deployment
Vercel

## Project Setup

Clone the repository

git clone https://github.com/YOUR_USERNAME/env-monitor.git
cd env-monitor

Install dependencies

npm install

Create a file named .env.local and add the following

NEXT_PUBLIC_MQTT_URL=
NEXT_PUBLIC_MQTT_USERNAME=
NEXT_PUBLIC_MQTT_PASSWORD=

Run the project

npm run dev

## MQTT Details

Topic used
env/data

Ports
ESP8266 uses 8883
Web dashboard uses 8884

Example data format

{
"temp": 28,
"hum": 65,
"air": 300
}

## Notes

MQ 135 sensor needs some time to stabilize so initial readings may not be accurate
Internet connection is required for real time updates

## Future Improvements

Add data storage and history tracking
Add alerts and notifications
Improve accuracy using better sensors
Build a mobile version of the dashboard

## Author

Shuban Shinde

B.Tech AI and Data Science
Thakur College of Engineering and Technology Mumbai

## Connect With Me

LinkedIn https://www.linkedin.com/in/shuban-shinde-58437838b
Email [shuban1227@gmail.com]
(mailto:shuban1227@gmail.com)

## License

This project is open source and available under the MIT License
