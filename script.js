import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase Setup
const appId = typeof __app_id !== 'undefined' ? __app_id : 'prmofive-chat-app';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyDummyKeyForDemoModeOnly",
    authDomain: "demo.firebaseapp.com",
    projectId: "demo-project",
    storageBucket: "demo.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:demo"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global States
let currentUser = null;
let selectedAvatarUrl = "https://api.dicebear.com/7.x/bottts/svg?seed=Alex";
let tempProfileAvatarUrl = null;
let activeChannelId = 'global';
let activeChannelName = 'Ruang Chat Publik';
let unsubscribeMessages = null;
let allUsersData = [];

// Voice Recording States
let recordingInterval = null;
let recordingSeconds = 0;

// Story States
let storyType = 'text';
let storyBgColor = '#0284c7';
let storyImageData = '';
let activeStoryUser = null;
let storyProgressTimer = null;
let storyProgressVal = 0;

window.selectAvatar = (element) => {
    document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('border-brand-500'));
    document.querySelectorAll('.avatar-option').forEach(el => el.classList.add('border-transparent'));
    element.classList.remove('border-transparent');
    element.classList.add('border-brand-500');
    selectedAvatarUrl = element.src;
    document.getElementById('login-avatar-preview').src = selectedAvatarUrl;
};

window.handleLoginAvatarFile = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            selectedAvatarUrl = evt.target.result;
            document.getElementById('login-avatar-preview').src = selectedAvatarUrl;
        };
        reader.readAsDataURL(file);
    }
};

async function initAuth() {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    } catch (err) {
        console.error("Auth Exception:", err);
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('my-user-id-display').innerText = user.uid;
        
        listenToOnlineUsers();
        listenToMessages('global');
        listenToStories();
    }
});

initAuth();

window.handleLogin = async (e) => {
    e.preventDefault();
    const username = document.getElementById('username-input').value.trim();
    if (!username || !currentUser) return;

    try {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUser.uid);
        await setDoc(userRef, {
            uid: currentUser.uid,
            name: username,
            avatar: selectedAvatarUrl,
            lastActive: new Date().toISOString()
        }, { merge: true });

        document.getElementById('my-profile-avatar').src = selectedAvatarUrl;
        document.getElementById('my-story-avatar').src = selectedAvatarUrl;
        document.getElementById('login-modal').classList.add('hidden');
        showToast(`Selamat Datang, ${username}!`);
    } catch (err) {
        console.error("Set Profile Error:", err);
        showToast("Gagal mendaftar pengguna!");
    }
};

// EDIT PROFILE LOGIC
window.openEditProfileModal = () => {
    const currentAvatar = document.getElementById('my-profile-avatar').src;
    const currentName = document.getElementById('username-input').value || 'User';
    document.getElementById('profile-edit-preview').src = currentAvatar;
    document.getElementById('profile-name-input').value = currentName;
    tempProfileAvatarUrl = currentAvatar;
    document.getElementById('edit-profile-modal').classList.remove('hidden');
};

window.closeEditProfileModal = () => {
    document.getElementById('edit-profile-modal').classList.add('hidden');
};

window.handleProfileFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            tempProfileAvatarUrl = evt.target.result;
            document.getElementById('profile-edit-preview').src = tempProfileAvatarUrl;
        };
        reader.readAsDataURL(file);
    }
};

window.updateProfilePreviewFromUrl = () => {
    const url = document.getElementById('profile-url-input').value.trim();
    if (url) {
        tempProfileAvatarUrl = url;
        document.getElementById('profile-edit-preview').src = url;
    }
};

window.setProfilePresetAvatar = (url) => {
    tempProfileAvatarUrl = url;
    document.getElementById('profile-edit-preview').src = url;
};

window.saveProfileChanges = async (e) => {
    e.preventDefault();
    const newName = document.getElementById('profile-name-input').value.trim();
    if (!newName || !currentUser) return;

    try {
        const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', currentUser.uid);
        await setDoc(userRef, {
            uid: currentUser.uid,
            name: newName,
            avatar: tempProfileAvatarUrl || selectedAvatarUrl,
            lastActive: new Date().toISOString()
        }, { merge: true });

        selectedAvatarUrl = tempProfileAvatarUrl || selectedAvatarUrl;
        document.getElementById('my-profile-avatar').src = selectedAvatarUrl;
        document.getElementById('my-story-avatar').src = selectedAvatarUrl;
        document.getElementById('username-input').value = newName;

        closeEditProfileModal();
        showToast("Foto profil & nama berhasil diperbarui!");
    } catch (err) {
        console.error("Save Profile Error:", err);
        showToast("Gagal menyimpan perubahan profil!");
    }
};

// Tab Switching
window.switchTab = (tab) => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-white/20', 'text-white');
        btn.classList.add('text-white/70');
    });

    if (tab === 'chats') {
        document.getElementById('nav-chats').classList.add('bg-white/20', 'text-white');
        document.getElementById('tab-content-chats').classList.remove('hidden');
        document.getElementById('tab-content-stories').classList.add('hidden');
        document.getElementById('panel-title').innerText = "PRMOFIVE CHAT";
    } else if (tab === 'stories') {
        document.getElementById('nav-stories').classList.add('bg-white/20', 'text-white');
        document.getElementById('tab-content-chats').classList.add('hidden');
        document.getElementById('tab-content-stories').classList.remove('hidden');
        document.getElementById('panel-title').innerText = "STORY REALTIME";
    }
};

// Realtime Users List & Search Filter
function listenToOnlineUsers() {
    const usersCol = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    
    onSnapshot(usersCol, (snapshot) => {
        allUsersData = [];
        snapshot.docs.forEach(docSnap => {
            const userData = docSnap.data();
            if (userData.uid !== currentUser?.uid) {
                allUsersData.push(userData);
            }
        });
        renderUsersList(allUsersData);
    }, (err) => console.error("Users Listener Error:", err));
}

function renderUsersList(users) {
    const container = document.getElementById('users-list-container');
    container.innerHTML = '';

    users.forEach(userData => {
        const userHtml = `
            <div onclick="selectChannel('${userData.uid}', '${userData.name}', '${userData.avatar}')" class="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition">
                <div class="relative shrink-0">
                    <img src="${userData.avatar}" class="w-10 h-10 rounded-full object-cover">
                    <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-semibold text-sm text-slate-800 truncate">${userData.name}</h4>
                    <p class="text-[11px] text-slate-400 truncate">Klik untuk mengobrol</p>
                </div>
            </div>
        `;
        container.innerHTML += userHtml;
    });

    if (users.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">Tidak ada pengguna ditemukan.</div>';
    }
}

window.filterContactsList = () => {
    const query = document.getElementById('search-contacts-input').value.toLowerCase();
    const filtered = allUsersData.filter(u => u.name.toLowerCase().includes(query));
    renderUsersList(filtered);
};

// Switch Active Chat
window.selectChannel = (channelId, name, avatar) => {
    activeChannelId = channelId;
    activeChannelName = name;

    document.getElementById('active-name').innerText = name;
    document.getElementById('active-avatar').src = avatar;
    document.getElementById('active-status-text').innerText = channelId === 'global' ? 'Semua Pengguna Terhubung' : 'Pesan Langsung';

    listenToMessages(channelId);

    if (window.innerWidth < 640) {
        document.getElementById('secondary-panel').classList.add('hidden');
    }
};

// Realtime Messages Listener
function listenToMessages(channelId) {
    if (unsubscribeMessages) unsubscribeMessages();

    const messagesCol = collection(db, 'artifacts', appId, 'public', 'data', `messages_${channelId}`);

    unsubscribeMessages = onSnapshot(messagesCol, (snapshot) => {
        const container = document.getElementById('messages-container');
        container.innerHTML = '';

        let msgs = [];
        snapshot.docs.forEach(docSnap => msgs.push({ id: docSnap.id, ...docSnap.data() }));

        msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        msgs.forEach(msg => {
            const isMe = msg.senderUid === currentUser?.uid;
            const html = `
                <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[75%] md:max-w-[60%] ${isMe ? 'bg-brand-600 text-white rounded-2xl rounded-tr-none' : 'bg-white text-slate-800 rounded-2xl rounded-tl-none'} p-3 shadow-sm border ${isMe ? 'border-brand-600' : 'border-slate-100'}">
                        ${!isMe ? `<p class="text-[10px] font-bold text-brand-600 mb-1">${msg.senderName || 'User'}</p>` : ''}
                        ${msg.replyToStory ? `<div class="bg-black/10 p-2 rounded-lg text-xs mb-2 border-l-2 border-brand-300 italic">Membalas Story: "${msg.replyToStory}"</div>` : ''}
                        ${msg.imageUrl ? `<img src="${msg.imageUrl}" class="w-full max-h-60 object-cover rounded-xl mb-2">` : ''}
                        ${msg.isVoice ? `<div class="flex items-center gap-2 my-1"><i class="fa-solid fa-play text-xs"></i><div class="h-1 bg-brand-200 flex-1 rounded"></div><span class="text-[10px]">${msg.text}</span></div>` : `<p class="text-sm leading-relaxed">${msg.text}</p>`}
                        <div class="flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-brand-100' : 'text-slate-400'}">
                            <span>${msg.time}</span>
                            ${isMe ? '<i class="fa-solid fa-check-double text-[9px]"></i>' : ''}
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });

        container.scrollTop = container.scrollHeight;
    }, (err) => console.error("Messages Listener Error:", err));
}

// Send Message & Attachments
window.handleSendMessage = async (e, customText = null, replyStoryContext = null, imageUrl = null, isVoice = false) => {
    if (e) e.preventDefault();
    const input = document.getElementById('message-input');
    const text = customText || input.value.trim();

    if ((!text && !imageUrl) || !currentUser) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
        const messagesCol = collection(db, 'artifacts', appId, 'public', 'data', `messages_${activeChannelId}`);
        await addDoc(messagesCol, {
            text: text || '',
            senderUid: currentUser.uid,
            senderName: document.getElementById('username-input').value || 'User',
            time: timeStr,
            imageUrl: imageUrl || null,
            isVoice: isVoice,
            replyToStory: replyStoryContext || null,
            createdAt: now.toISOString()
        });

        if (!customText && !imageUrl) input.value = '';
    } catch (err) {
        console.error("Send Message Error:", err);
        showToast("Gagal mengirim pesan!");
    }
};

// Image Attachment Handler
window.triggerImageAttachment = () => document.getElementById('chat-image-input').click();

window.handleImageAttachment = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            handleSendMessage(null, "Gambar Terkirim", null, evt.target.result);
        };
        reader.readAsDataURL(file);
    }
};

// Simulated Voice Note Recording
window.startVoiceRecording = () => {
    recordingSeconds = 0;
    document.getElementById('voice-recording-bar').classList.remove('hidden');
    recordingInterval = setInterval(() => {
        recordingSeconds++;
        const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
        const secs = String(recordingSeconds % 60).padStart(2, '0');
        document.getElementById('recording-timer').innerText = `${mins}:${secs}`;
    }, 1000);
};

window.cancelVoiceRecording = () => {
    clearInterval(recordingInterval);
    document.getElementById('voice-recording-bar').classList.add('hidden');
};

window.sendVoiceRecording = () => {
    clearInterval(recordingInterval);
    document.getElementById('voice-recording-bar').classList.add('hidden');
    const duration = document.getElementById('recording-timer').innerText;
    handleSendMessage(null, `Pesan Suara (${duration})`, null, null, true);
};

// REALTIME STORIES FEATURE
function listenToStories() {
    const storiesCol = collection(db, 'artifacts', appId, 'public', 'data', 'stories');

    onSnapshot(storiesCol, (snapshot) => {
        const container = document.getElementById('stories-list-container');
        container.innerHTML = '';

        let stories = [];
        const now = new Date().getTime();

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const storyTime = new Date(data.createdAt).getTime();
            if (now - storyTime < 24 * 60 * 60 * 1000) {
                stories.push({ id: docSnap.id, ...data });
            }
        });

        stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        stories.forEach(story => {
            const html = `
                <div onclick="viewStory('${encodeURIComponent(JSON.stringify(story))}')" class="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition">
                    <div class="story-ring rounded-full shrink-0">
                        <img src="${story.authorAvatar}" class="w-11 h-11 rounded-full object-cover border-2 border-white">
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-sm text-slate-800 truncate">${story.authorName}</h4>
                        <p class="text-[11px] text-slate-400 truncate">${story.timeStr}</p>
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });

        if (stories.length > 0) {
            document.getElementById('story-badge-dot').classList.remove('hidden');
        }

        if (container.children.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">Belum ada story dalam 24 jam terakhir.</div>';
        }
    });
}

// Story Modal Helpers
window.openCreateStoryModal = () => document.getElementById('create-story-modal').classList.remove('hidden');
window.closeCreateStoryModal = () => document.getElementById('create-story-modal').classList.add('hidden');

window.setStoryType = (type) => {
    storyType = type;
    if (type === 'text') {
        document.getElementById('btn-story-text').className = "flex-1 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white shadow-sm";
        document.getElementById('btn-story-image').className = "flex-1 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600";
        document.getElementById('story-text-controls').classList.remove('hidden');
        document.getElementById('story-image-controls').classList.add('hidden');
        document.getElementById('story-preview-img').classList.add('hidden');
        document.getElementById('story-preview-text').classList.remove('hidden');
    } else {
        document.getElementById('btn-story-image').className = "flex-1 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white shadow-sm";
        document.getElementById('btn-story-text').className = "flex-1 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600";
        document.getElementById('story-image-controls').classList.remove('hidden');
        document.getElementById('story-text-controls').classList.add('hidden');
    }
};

window.setStoryBg = (color) => {
    storyBgColor = color;
    document.getElementById('story-preview-bg').style.backgroundColor = color;
};

window.updateStoryPreview = () => {
    if (storyType === 'text') {
        const text = document.getElementById('story-input-text').value;
        document.getElementById('story-preview-text').innerText = text || "Ketik sesuatu...";
    } else {
        const url = document.getElementById('story-input-imgurl').value;
        if (url) {
            document.getElementById('story-preview-img').src = url;
            document.getElementById('story-preview-img').classList.remove('hidden');
            document.getElementById('story-preview-text').classList.add('hidden');
        }
    }
};

window.handleStoryFile = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            storyImageData = evt.target.result;
            document.getElementById('story-preview-img').src = storyImageData;
            document.getElementById('story-preview-img').classList.remove('hidden');
            document.getElementById('story-preview-text').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
};

window.publishStory = async () => {
    if (!currentUser) return;
    const now = new Date();
    const textContent = document.getElementById('story-input-text').value;
    const imgUrl = document.getElementById('story-input-imgurl').value || storyImageData;

    try {
        const storiesCol = collection(db, 'artifacts', appId, 'public', 'data', 'stories');
        await addDoc(storiesCol, {
            authorUid: currentUser.uid,
            authorName: document.getElementById('username-input').value || 'User',
            authorAvatar: selectedAvatarUrl,
            type: storyType,
            text: textContent,
            bgColor: storyBgColor,
            imageUrl: imgUrl,
            timeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: now.toISOString()
        });

        closeCreateStoryModal();
        showToast("Story berhasil dipublikasikan!");
    } catch (err) {
        console.error("Publish Story Error:", err);
        showToast("Gagal mempublikasikan story!");
    }
};

// Fullscreen Story Viewer Controls
window.viewStory = (storyJsonEncoded) => {
    const story = JSON.parse(decodeURIComponent(storyJsonEncoded));
    activeStoryUser = story;

    document.getElementById('viewer-user-name').innerText = story.authorName;
    document.getElementById('viewer-user-avatar').src = story.authorAvatar;
    document.getElementById('viewer-time').innerText = story.timeStr;

    const body = document.getElementById('viewer-body');
    body.style.backgroundColor = story.type === 'text' ? story.bgColor : '#000';

    if (story.type === 'text') {
        body.innerHTML = `<p class="text-xl md:text-2xl font-bold max-w-xs leading-relaxed">${story.text}</p>`;
    } else {
        body.innerHTML = `<img src="${story.imageUrl}" class="max-h-full max-w-full object-contain">`;
    }

    document.getElementById('story-viewer-modal').classList.remove('hidden');
    startStoryTimer();
};

function startStoryTimer() {
    storyProgressVal = 0;
    const bar = document.getElementById('story-progress-bar');
    clearInterval(storyProgressTimer);

    storyProgressTimer = setInterval(() => {
        storyProgressVal += 2;
        bar.style.width = `${storyProgressVal}%`;
        if (storyProgressVal >= 100) {
            closeStoryViewer();
        }
    }, 100);
}

window.closeStoryViewer = () => {
    clearInterval(storyProgressTimer);
    document.getElementById('story-viewer-modal').classList.add('hidden');
};

window.handleReplyStory = (e) => {
    e.preventDefault();
    const replyInput = document.getElementById('story-reply-input');
    const replyText = replyInput.value.trim();

    if (replyText && activeStoryUser) {
        selectChannel(activeStoryUser.authorUid, activeStoryUser.authorName, activeStoryUser.authorAvatar);
        handleSendMessage(null, replyText, activeStoryUser.type === 'text' ? activeStoryUser.text : 'Gambar Story');
        replyInput.value = '';
        closeStoryViewer();
        switchTab('chats');
        showToast("Balasan story terkirim!");
    }
};

// Basic UI Helpers
window.copyMyUserId = () => {
    if (currentUser) {
        navigator.clipboard.writeText(currentUser.uid);
        showToast("ID Pengguna disalin!");
    }
};

window.toggleMobileSidebar = () => {
    document.getElementById('secondary-panel').classList.toggle('hidden');
};

window.toggleEmojiPicker = () => {
    document.getElementById('emoji-picker').classList.toggle('hidden');
};

window.addEmoji = (emoji) => {
    const input = document.getElementById('message-input');
    input.value += emoji;
    window.toggleEmojiPicker();
    input.focus();
};

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').innerText = message;
    toast.classList.remove('translate-y-[-100px]', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-[-100px]', 'opacity-0'), 3000);
}
