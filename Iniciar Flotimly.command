#!/bin/zsh
# Doble clic para abrir Flotimly en el navegador.
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if [ ! -d node_modules ]; then
  echo "Instalando dependencias (sólo la primera vez)..."
  npm install
fi
echo "Abriendo Flotimly en http://localhost:5173 — deja esta ventana abierta mientras lo usas."
npm run dev
