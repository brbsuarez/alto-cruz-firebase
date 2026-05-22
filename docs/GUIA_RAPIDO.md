# 📋 Guia Rápido - Integração PADC + Site Público

## ✅ Status: INTEGRAÇÃO COMPLETA E FUNCIONAL

---

## 🎯 O Que Foi Implementado

### Site Público (site_pousadaaltodacruz)
```
✅ Formulário de reserva completo
✅ Campos: Nome, WhatsApp, CPF, Check-in, Check-out, Hóspedes, Quarto, Observações
✅ Validação de campos obrigatórios
✅ Integração Firebase (mesmo do PADC)
✅ Envia dados para Firestore sem autenticação
✅ Mensagem de sucesso/erro
✅ Botão WhatsApp sempre funcional
✅ Design responsivo (mobile, tablet, desktop)
✅ Performance otimizada
```

### Firebase (padc-991e3)
```
✅ Coleção "reservations" recebe dados do site
✅ Campo "source: site" marca origem
✅ Campo "status: pendente" marca não confirmada
✅ Firestore Rules permitem apenas criação segura
✅ Auditoria registra tudo
```

### Sistema Admin (PADC)
```
✅ Página "Reservas" mostra pendentes do site
✅ Seção especial: "Reservas Pendentes do Site"
✅ Ações: Aprovar, Rejeitar
✅ Aprovação vincula quarto e confirma
✅ Rejeição cancela reserva
✅ Logs em Auditoria
```

---

## 📁 Arquivos Principais

| Arquivo | Função |
|---------|--------|
| `site_pousadaaltodacruz/index.html` | Formulário do site |
| `site_pousadaaltodacruz/script.js` | Lógica de submissão |
| `site_pousadaaltodacruz/firebase.js` | Função enviarReserva() |
| `site_pousadaaltodacruz/config.js` | Firebase config (padc-991e3) |
| `src/App.jsx` | PADC Admin (Reservas) |
| `firestore.rules` | Regras de segurança |
| `DEPLOY_CLOUDFLARE.md` | Como fazer deploy |
| `RELATORIO_INTEGRACAO.md` | Relatório completo |
| `RESUMO_TECNICO.md` | Referência técnica |

---

## 🚀 Para Fazer Deploy

### 1. Clonar/Fazer Commit

```bash
# Se ainda não é um repo Git
cd c:\Users\Admin\Desktop\alto-cruz-firebase
git init
git add -A
git commit -m "feat: Site + PADC Firebase Integration"

# Se já é repo
git add -A
git commit -m "feat: Site + PADC Firebase Integration"
git push
```

### 2. Cloudflare Pages

1. Acesse https://pages.cloudflare.com
2. Clique "Connect to Git"
3. Selecione repositório `alto-cruz-firebase`
4. Configure:
   - Build command: `npm run build`
   - Output directory: `dist`
5. Deploy automático ao fazer push

### 3. Domínio Personalizado

1. Em Cloudflare Pages settings
2. Add Custom Domain
3. Aponte nameservers do registrador

---

## 📊 Fluxo Rápido

```
1. Usuário acessa site
   ↓
2. Preenche formulário de reserva
   ↓
3. Clica "Enviar Reserva"
   ↓
4. Script valida campos
   ↓
5. Envia para Firebase (padc-991e3)
   ↓
6. Firestore cria documento com:
   - source: "site"
   - status: "pendente"
   - Todos os dados preenchidos
   ↓
7. Site mostra "Reserva enviada com sucesso"
   ↓
8. Admin vê em PADC → Reservas → "Reservas Pendentes do Site"
   ↓
9. Admin aprova e vincula quarto
   ↓
10. Status muda para "confirmada"
    ↓
11. Log registrado em Auditoria
```

---

## 🔐 Segurança

### Firestore Rules
```firestore
✅ Site pode CRIAR com source="site" && status="pendente"
✅ Site NÃO pode LER, ATUALIZAR, DELETAR
✅ Admin/Staff podem fazer tudo com reservas
✅ Sem risco de manipulação por usuários
```

---

## 🧪 Testar Localmente

```bash
# Instalar dependências
npm install

# Desenvolver (site em http://localhost:5173)
npm run dev

# Build (cria pasta dist/)
npm run build

# Preview (testa build local)
npm run preview
```

---

## 📝 Dados Salvos da Reserva

Quando usuário submete formulário:

```json
{
  "guestName": "João Silva",
  "phone": "71985610497",
  "cpf": "123.456.789-00",
  "checkIn": "2026-05-23",
  "checkOut": "2026-05-25",
  "people": 2,
  "roomType": "Quarto casal",
  "notes": "Precisa de berço",
  "source": "site",
  "status": "pendente",
  "createdAt": 1674123456789
}
```

---

## ✨ Recursos Especiais

- 🔒 **Seguro**: Firestore Rules + validação frontend
- 📱 **Mobile**: Formulário responsivo
- ⚡ **Rápido**: Build otimizado para Cloudflare
- 🌐 **Online**: Hospedado na Cloudflare Pages
- 📊 **Rastreável**: Auditoria de tudo
- 💬 **WhatsApp**: Botão sempre acessível
- ✅ **Validado**: Campos checados antes de enviar

---

## 📞 Documentação Completa

- **DEPLOY_CLOUDFLARE.md**: Como fazer deploy passo a passo
- **RELATORIO_INTEGRACAO.md**: Relatório técnico completo
- **RESUMO_TECNICO.md**: Referência de código

---

## 🆘 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| Erro ao enviar reserva | Verificar console do navegador (F12) |
| Reserva não aparece no Admin | Verificar se tem source="site" no Firestore |
| Build falha | `rm -rf node_modules && npm install` |
| Site lento | Verificar tamanho do bundle em dist/ |

---

## 📋 Checklist Final

- [x] Site usa Firebase correto (padc-991e3)
- [x] Formulário tem todos os campos
- [x] Validação funciona
- [x] Envia para Firestore
- [x] Admin recebe no PADC
- [x] Admin pode aprovar/rejeitar
- [x] Auditoria funciona
- [x] Segurança implementada
- [x] Build otimizado
- [x] Documentação completa
- [ ] Deploy na Cloudflare (próxima etapa)

---

## 🎬 Próximas Ações

1. **Git**: Fazer commit e push
2. **Cloudflare**: Conectar repositório
3. **Deploy**: Fazer primeiro deploy
4. **Testes**: Testar em produção
5. **Domínio**: Configurar pousadaaltodacruz.com.br

---

**Versão**: 1.0  
**Data**: 22 de maio de 2026  
**Status**: ✅ Pronto para Produção
