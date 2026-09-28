@echo off
echo ===================================================
echo  RECALLA — Incident Intelligence Platform
echo  Remember incidents. Resolve faster.
echo ===================================================
echo.
echo Step 1: Starting FastAPI + Hindsight Backend...
cd backend
call venv\Scripts\activate
start "RECALLA Backend (FastAPI)" cmd /k "uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo Backend running on http://0.0.0.0:8000 (accessible on LAN)
echo.

echo Step 2: Starting Expo Mobile Application (React Native)...
cd ..\mobile
start "RECALLA Mobile (Expo)" cmd /k "npx expo start"
echo.
echo ===================================================
echo  RECALLA Mobile App is Ready!
echo ===================================================
echo.
echo  - Scan QR code with Expo Go (iOS / Android)
echo  - Press 'a' in the Expo window for Android Emulator
echo  - Press 'i' in the Expo window for iOS Simulator
echo  - Press 'w' in the Expo window for Web Preview
echo.
pause
