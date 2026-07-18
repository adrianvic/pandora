<img width="1920" height="auto" alt="PANDORA" src="https://github.com/user-attachments/assets/d9d7ba36-4510-47e1-8c49-b1977a26c448" />

Pandora is an open-source web client for the WAHA API.

## Features
- [x] Contact list<sup>1</sup>
- [x] Chat screen<sup>2</sup>
- [x] Sending messages
- [ ] Sending polls
- [X] Receiving messages (WebSocket)<sup>3</sup>
- [ ] Receiving polls
- [ ] Answering polls
- [ ] Sending audio messages
- [x] Sending attachments (sends image/video as such)<sup>4</sup>
- [x] Notification sound<sup>5</sup>
- [x] Browser notification
- [x] Download attachments
- [x] Automatically download images<sup>6</sup>
- [X] Local message storing
- [ ] Message encryption
- [ ] Light theme
- [X] Custom wallpaper

1. Does not show contact name in any engine other than WEBJS
2. Loads the last 40 messages
3. Will not contain contact name in groups if you're in any engine other than WEBJS
4. You will receive a duplicate of your attachment in any engine other than WEBJS
5. Allow autoplay to avoid blocking
6. Only on WEBJS engine

## Setup
1. Check [WAHA Docs](https://waha.devlike.pro/docs/) to setup WAHA
2. Serve Pandora in any HTTP server. The GitHub Pages for this repository will only work for WAHA servers over HTTPS (due to mixed content)
3. It works better with WEBJS engine.
4. Access Pandora and change the server address, session and API key to match your server
5. You should probably be good to go

## Frequently Asked Questions

### Why?
Because WhatsApp won't run on my LineageOS. Seems like the APK from WhatsApp's own website doesn't count official.
Sadly there are places in the world where you need this bullshit application to be a functional human being.

### Will this get me banned?
It's against WhatsApp TOS, though it mocks message typing and should not be able to be identified so easily. I haven't got myself nor heard anyone getting in trouble for using WAHA correctly. 

### How it works
Pure magic. (Mocks a WhatsApp Web session)
