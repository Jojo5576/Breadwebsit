// Frontend: connect to WebSocket chat and manage UI

(() => {
  // DOM
  const chatWidget = document.getElementById('chat-widget');
  const openChatBtn = document.getElementById('open-chat-btn');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatForm = document.getElementById('chat-form');
  const messageInput = document.getElementById('message-input');
  const messagesEl = document.getElementById('messages');
  const nameInput = document.getElementById('name-input');
  const nameModal = document.getElementById('name-modal');
  const modalName = document.getElementById('modal-name');
  const modalJoin = document.getElementById('modal-join');

  let displayName = localStorage.getItem('happyloaf_name') || '';
  let socket;
  let connected = false;

  // Toggle chat
  openChatBtn.addEventListener('click', () => {
    openChat();
  });
  closeChatBtn.addEventListener('click', () => {
    closeChat();
  });

  function openChat(){
    if (!displayName) {
      showNameModal();
      return;
    }
    chatWidget.classList.remove('hidden');
    chatWidget.setAttribute('aria-hidden', 'false');
    if (!connected) startSocket();
    // focus message input
    setTimeout(()=>messageInput.focus(), 200);
  }
  function closeChat(){
    chatWidget.classList.add('hidden');
    chatWidget.setAttribute('aria-hidden', 'true');
  }

  // Name modal
  function showNameModal(){
    nameModal.classList.remove('hidden');
    modalName.focus();
  }
  function hideNameModal(){
    nameModal.classList.add('hidden');
  }
  modalJoin.addEventListener('click', () => {
    const n = modalName.value.trim() || 'Guest';
    displayName = n.slice(0,30);
    localStorage.setItem('happyloaf_name', displayName);
    nameInput.value = displayName;
    hideNameModal();
    startSocket();
    chatWidget.classList.remove('hidden');
    messageInput.focus();
    sendJoinNotice();
  });

  // keep input name synced
  nameInput.addEventListener('change', () => {
    const val = nameInput.value.trim() || 'Guest';
    displayName = val.slice(0,30);
    localStorage.setItem('happyloaf_name', displayName);
  });

  // Form submit -> send message
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    const msg = {
      type: 'message',
      name: displayName || 'Guest',
      text
    };
    sendMessage(msg);
    messageInput.value = '';
  });

  // WebSocket
  function startSocket() {
    if (connected) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const endpoint = `${protocol}://${location.host}`;
    socket = new WebSocket(endpoint);

    socket.addEventListener('open', () => {
      connected = true;
      // set name input
      nameInput.value = displayName || '';
      // notify server we joined
      sendJoinNotice();
    });

    socket.addEventListener('message', (ev) => {
      let payload;
      try {
        payload = JSON.parse(ev.data);
      } catch (e) { return; }

      if (payload.type === 'history' && Array.isArray(payload.data)) {
        // clear then add
        messagesEl.innerHTML = '';
        payload.data.forEach(addMessageToDom);
        scrollToBottom();
      } else {
        addMessageToDom(payload);
        scrollToBottom();
      }
    });

    socket.addEventListener('close', () => {
      connected = false;
      addSystemMessage('Disconnected. Reconnect on activity.');
      // try basic reconnect
      setTimeout(() => {
        if (!connected) startSocket();
      }, 3000);
    });

    socket.addEventListener('error', (err) => {
      console.error('WebSocket error', err);
    });
  }

  function sendJoinNotice(){
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'join', name: displayName || 'Guest' }));
  }

  function sendMessage(obj){
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      // optimistic local echo if not connected
      addMessageToDom({...obj, _local:true, time: Date.now()});
      addSystemMessage('Message queued — connecting...');
      startSocket();
      // attempt to send when open
      const trySend = () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(obj));
        } else {
          setTimeout(trySend, 500);
        }
      };
      trySend();
      return;
    }
    socket.send(JSON.stringify(obj));
    // local echo (server will also broadcast back; this keeps UI snappy)
    addMessageToDom({...obj, _local:true, time: Date.now()});
  }

  // DOM helpers
  function addMessageToDom(msg) {
    // msg types: message (user), system
    const el = document.createElement('div');
    if (msg.type === 'system') {
      el.className = 'msg system';
      el.textContent = formatTime(msg.time) + ' — ' + (msg.text || '');
    } else if (msg.type === 'message') {
      const isLocal = msg.name === (displayName || '') || msg._local;
      el.className = 'msg ' + (isLocal ? 'you' : 'other');
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${msg.name || 'Guest'} • ${formatTime(msg.time)}`;
      const txt = document.createElement('div');
      txt.className = 'text';
      txt.textContent = msg.text || '';
      el.appendChild(meta);
      el.appendChild(txt);
    } else if (msg.type === 'history') {
      // ignore
      return;
    } else {
      // fallback
      el.className = 'msg';
      el.textContent = JSON.stringify(msg);
    }
    messagesEl.appendChild(el);

    // keep last ~200 messages
    if (messagesEl.children.length > 300) {
      messagesEl.removeChild(messagesEl.children[0]);
    }
  }

  function addSystemMessage(text) {
    addMessageToDom({ type:'system', text, time: Date.now() });
  }

  function formatTime(ts) {
    if (!ts) ts = Date.now();
    const d = new Date(ts);
    return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  }

  function scrollToBottom(){
    chatBody = document.querySelector('.chat-body');
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // If user already has name, start socket in background (optional)
  if (displayName) {
    startSocket();
  } else {
    // keep open-chat button to prompt
    openChatBtn.addEventListener('click', showNameModal);
  }

  // allow pressing Enter in modal to join
  modalName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') modalJoin.click();
  });

  // also allow Enter in message input to send faster (form handles it)
})();
