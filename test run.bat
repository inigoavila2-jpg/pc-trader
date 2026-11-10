@echo off
cd /d "%~dp0"

echo Staging all changes...
git add .

set /p msg="Enter commit message (Press Enter for 'Update App.jsx'): "
if "%msg%"=="" set msg=Update App.jsx

echo Committing changes...
git commit -m "%msg%"

echo Fetching and integrating remote changes...
git pull origin main --rebase

echo Pushing to pc-trader...
git push origin main

echo.
echo Update complete!
pause