# Guia de Deploy do Site Público na Cloudflare Pages

## 📋 Pré-requisitos

- Conta GitHub com o repositório do projeto
- Conta Cloudflare Pages
- Node.js LTS instalado localmente
- npm ou yarn

## 🔧 Passos de Configuração

### 1. Preparar o Repositório Git

```bash
cd c:\Users\Admin\Desktop\alto-cruz-firebase
git init
git add .
git commit -m "Initial commit: PADC Firebase with Cloudflare integration"
git branch -M main
git remote add origin https://github.com/seu-usuario/alto-cruz-firebase
git push -u origin main
```

### 2. Configurar Cloudflare Pages

1. Acesse https://pages.cloudflare.com
2. Clique em "Connect to Git"
3. Authorize GitHub e selecione o repositório `alto-cruz-firebase`
4. Configure o build:
   - **Project name**: `alto-cruz-firebase`
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`

### 3. Variáveis de Ambiente (se necessário)

Se houver sensibilidade em dados Firebase, considere:
- Não commitar dados sensíveis no GitHub
- Usar Cloudflare Pages Environment Variables para dados sensíveis (opcional)

### 4. Deploy Automático

Após configurar:
- Todo commit em `main` dispara build automático
- Site fica disponível em `https://seu-projeto.pages.dev`

### 5. Domínio Personalizado

1. Em Cloudflare Pages settings
2. Clique em "Custom domain"
3. Adicione seu domínio (ex: pousadaaltodacruz.com.br)
4. Atualize os nameservers no registrador de domínio

## 🚀 Build Local para Testes

```bash
npm install
npm run build
npm run preview
```

Acesse `http://localhost:4173` para visualizar

## 📱 Fluxo de Funcionalidades

### Site Público
- ✅ Formulário de reserva com validação
- ✅ Campos: nome, WhatsApp, CPF, check-in, check-out, hóspedes, tipo quarto, observações
- ✅ Envia dados para Firebase sem autenticação
- ✅ Mensagem de sucesso com instrução de contato
- ✅ Botão WhatsApp sempre funcional

### Firebase (padc-991e3)
- ✅ Coleção `reservations` recebe dados do site
- ✅ Campo `source: "site"` identifica origem
- ✅ Campo `status: "pendente"` marca como não confirmada
- ✅ Firestore Rules permitem create sem auth

### Sistema Admin (PADC)
- ✅ Página "Reservas" mostra reservas pendentes do site
- ✅ Admin/funcionário pode aprovar, rejeitar ou vincular quarto
- ✅ Aprovação muda status para "confirmada"
- ✅ Auditoria registra todas as ações

## 🔐 Segurança

### Firestore Rules Aplicadas
```
match /reservations/{id} {
  allow create: if request.auth != null
    || (
      request.resource.data.source == "site" &&
      request.resource.data.status == "pendente"
    );

  allow read, update, delete: if isStaff();
}
```

### Proteções
- ✅ Site pode CRIAR reservas pendentes sem login
- ✅ Site NÃO pode ler reservas existentes
- ✅ Site NÃO pode atualizar/deletar
- ✅ Admin/funcionário pode ler e atualizar
- ✅ Admin/funcionário pode deletar (auditado)

## 🧪 Teste de Integração

1. Abra o site em `https://seu-dominio`
2. Preencha formulário de reserva
3. Clique "Enviar Reserva"
4. Verifique mensagem de sucesso
5. No PADC, acesse "Reservas"
6. Confirme que a reserva aparece em "Reservas Pendentes do Site"
7. Teste aprovar/rejeitar

## 📊 Monitoramento

- Firestore Console: Visualize dados brutos
- Cloud Logging: Verifique erros e auditoria
- Cloudflare Analytics: Performance do site

## 🆘 Troubleshooting

### "Erro ao enviar reserva"
- Verificar se `firebaseConfig` está correto
- Verificar se Firestore Rules permitem create
- Verificar console do navegador (F12)

### "Reserva não aparece no Admin"
- Verificar se `source: "site"` está presente
- Verificar se `status: "pendente"` está presente
- Verificar se Admin tem role "funcionario" ou "admin"

### Build falha
```bash
npm install
npm run build
# ou
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📝 Arquivos Modificados

### Site Público
- `site_pousadaaltodacruz/config.js` - Configuração Firebase
- `site_pousadaaltodacruz/firebase.js` - Função enviarReserva()
- `site_pousadaaltodacruz/index.html` - Formulário de reserva
- `site_pousadaaltodacruz/script.js` - Lógica do formulário
- `site_pousadaaltodacruz/styles.css` - Estilos do formulário

### Sistema Admin
- `src/App.jsx` - Página "Reservas" com suporte a reservas do site
- `firestore.rules` - Regras de segurança (já corretas)

## ✅ Checklist Final

- [ ] Git repository criado e conectado a GitHub
- [ ] Cloudflare Pages configurado
- [ ] Build local testado com sucesso
- [ ] Site acessível em pousadaaltodacruz.pages.dev
- [ ] Domínio personalizado configurado
- [ ] Formulário de reserva testado
- [ ] Reserva do site aparece no PADC
- [ ] Admin consegue aprovar/rejeitar
- [ ] Auditoria está registrando ações
- [ ] SSL/TLS ativo (automático no Cloudflare)

## 📞 Suporte

Para dúvidas técnicas:
- Documentação Firebase: https://firebase.google.com/docs
- Documentação Cloudflare Pages: https://developers.cloudflare.com/pages
- Vite: https://vitejs.dev

---

**Versão**: 1.0
**Última atualização**: 2026-05-22
**Projeto**: Pousada Alto da Cruz Firebase (PADC)
