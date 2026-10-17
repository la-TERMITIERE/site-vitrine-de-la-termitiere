@echo off
set CONTENT_DIR=%~dp0test-content-local
set SESSION_SECRET=test-secret-local
set COOKIE_SECURE=false
set USERS_JSON=[{"email":"test@example.com","passwordHash":"$2a$10$5Mk70ojt.u2eZ.gZKHBl6u69nozMohJ8ESN/w2Q9k3XqnyKPLlcES"}]
set PORT=8082

echo ============================================
echo Espace de publication - test local
echo Compte de test : test@example.com / test1234
echo ============================================
echo.
echo Une fois demarre, ouvre http://localhost:8082 dans ton navigateur.
echo Pour arreter : ferme cette fenetre ou Ctrl+C.
echo.

node server.js
pause
