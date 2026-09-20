@echo off
cd /d "%~dp0"

echo Fetching latest changes from GitHub...
git pull origin main --rebase

echo Staging all project files...
git add .

set /p msg="Enter commit message (Press Enter for 'Update project'): "
if "%msg%"=="" set msg=Update project

echo Committing changes...
git commit -m "%msg%"

echo Pushing to pc-trader...
git push origin main

echo.
echo Update complete!
pause