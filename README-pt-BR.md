[In English](README.md)

<img width="1920" height="auto" alt="PANDORA" src="https://github.com/user-attachments/assets/d9d7ba36-4510-47e1-8c49-b1977a26c448" />

Pandora é um cliente de navegador para a API WAHA.

## Funções
- [x] Lista de contatos<sup>1</sup>
- [x] Tela de mensagens<sup>2</sup>
- [x] Envio de mensagens
- [ ] Envio de enquetes
- [X] Recebimento de mensagens (WebSocket)<sup>3</sup>
- [ ] Recebimento de enquetes
- [ ] Responder enquetes
- [ ] Envio de mensagens de áudio
- [x] Envio de anexo (envia imagem/vídeo como tal)<sup>4</sup>
- [x] Som de notificação<sup>5</sup>
- [x] Notificação do navegador
- [x] Baixar anexos
- [x] Baixar imagens automaticamente<sup>6</sup>
- [X] Salvar mensagens localmente
- [ ] Criptografia de mensagem
- [X] Tema claro e escuro
- [X] Tela de fundo customizada
- [X] Responder mensagens
- [X] Mencionar usuários
- [x] Tocar áudios
- [x] Prévia das mensagens (aumentar e deslocar)
- [x] Interface de computador

1. Não mostra nome do contato em nenhum outro motor além do WEBJS
2. Carrega as últimas 40 mensagens, além disso é feita paginação
3. Não mostra nome do contato em grupos em nenhum outro motor além do WEBJS
4. Você recebe seus próprios anexos duplicadamente em qualquer outro motor que não o WEBJS
5. Autorize reprodução automática para evitar bloqueio
6. Apenas no motor WEBJS

## Configurando
1. Veja [WAHA Docs](https://waha.devlike.pro/docs/) para instalar o WAHA
2. Coloque o Pandora em qualqer servidor HTTP. Se usar HTTPS, o servidor WAHA também deve ser servido em HTTPS, caso contrário terá erros de mixed-content
3. Funciona melhor com o motor WEBJS
4. Acesse Pandora e configure ele para apontar para o seu servidor WAHA no menu de configuração inicial
5. Tudo pronto!

## Perguntas Frequentes

### Por quê?
Porque o WhatsApp se recusa a rodar no meu celular com LineageOS. Parece que o APK do site oficial do WhatsApp não conta como oficial.
Infelizmente existem lugares no mundo que você precisa dessa porcaria de aplicativo para ser um humano funcional.

### Isso vai me banir?
Usar o Pandora é conta os termos de uso do WhatsApp, porém ele simula digitação e, em teoria, não pode ser identificado. Eu nunca tive/ouvi alguém ter problema por usar o WAHA corretamente. 

### Como ele funciona?
Mágica. (Simula uma sessão do WhatsApp Web)
