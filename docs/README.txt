# Pousada AltoDaCruz Manager Firebase

Versão online com:
- Firebase Authentication
- Login por CPF
- Firestore como banco online
- Acesso por vários funcionários
- Painel admin para cadastrar recepcionistas
- Firebase Hosting

## Instalar no PC

1. Instale Node.js LTS.
2. Instale Firebase CLI:
   npm install -g firebase-tools

3. Entre na pasta:
   cd alto-cruz-firebase

4. Instale dependências:
   npm install

5. Rode local:
   npm run dev

## Configurar Firebase

1. Acesse Firebase Console.
2. Crie um projeto.
3. Ative Authentication > Sign-in method > Email/Password.
4. Ative Firestore Database.
5. Crie um app Web.
6. Copie a configuração firebaseConfig.
7. Cole em src/App.jsx no lugar de COLE_AQUI.

## Primeiro acesso

1. Abra o sistema.
2. Clique em "Primeiro acesso? Criar admin".
3. Cadastre o CPF do dono/admin e uma senha.
4. Depois entre com CPF e senha.

## Publicar online

1. Login no Firebase:
   firebase login

2. Inicialize ou vincule:
   firebase use --add

3. Deploy:
   npm run deploy

## Instalar no celular

Depois do deploy, abra o link no Chrome do celular:
- Menu ⋮
- Adicionar à tela inicial

Pronto: fica como aplicativo.

## Observação

O login por CPF funciona usando Firebase Auth com um email interno:
CPF 123.456.789-00 vira 12345678900@pousadaaltodacruz.local
