@echo off
echo.
echo ================================================
echo  RECALLA - Demo Data Seeder
echo  Remember incidents. Resolve faster.
echo ================================================
echo.
echo This will seed the database and Hindsight memory
echo with historical incident data for the hackathon demo.
echo.
echo Make sure:
echo  1. Backend is running (uvicorn app.main:app --reload)
echo  2. Hindsight server is running
echo  3. .env is configured with your API keys
echo.
cd backend
call venv\Scripts\activate
python seed_data.py
echo.
pause
