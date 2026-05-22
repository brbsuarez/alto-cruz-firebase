# Pousada Manager Premium

Versão premium preparada para venda.

## Incluído
- Login por CPF com Firebase Authentication
- Banco online Firestore
- Acesso multiusuário
- Admin cria usuários da recepção
- Painel Equipe & Escala
- Quartos, hóspedes, reservas, caixa e relatórios
- PDF de reserva
- WhatsApp
- Regras Firestore mais seguras para produção
- Área de configurações premium

## Rodar local
npm install
npm run dev

## Publicar
npm run build
firebase deploy

## Importante
No Firebase Console:
1. Authentication > Sign-in method > Email/Senha ativado
2. Firestore Database criado
3. Rules publicadas pelo deploy

## Corrigir usuário como admin
Firestore > users > abrir documento do usuário > campo role = admin

## Instalar no celular
Abrir https://padc-991e3.web.app no Chrome > menu > Adicionar à tela inicial.
