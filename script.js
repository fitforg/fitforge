/* FitForge client website
   Supabase schema used exactly as provided:
   conversations: id, visitor_id, status, created_at, visitor_name, fitness_goal
   messages: id, conversation_id, sender_id, sender_type, message, created_at, seen_at
*/

const SUPABASE_URL =
  "https://meawwgrgdkqepnybsqzj.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_c02NxPEZ4iRMb9t9j1PXyg_AFAYy02q";

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const profile = document.getElementById("visitorProfile");
const profileForm = document.getElementById("visitorProfileForm");
const profileStatus = document.getElementById("profileStatus");

const chatPanel = document.getElementById("chatPanel");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const resetProfileBtn = document.getElementById("resetProfileBtn");

const typingRow = document.getElementById("typingRow");
const coachStatus = document.getElementById("coachStatus");
const coachStatusDot = document.getElementById("coachStatusDot");
const conversationStatus = document.getElementById("conversationStatus");

const toast = document.getElementById("toast");

const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

document.documentElement.classList.add("js");

document.getElementById("year").textContent =
  new Date().getFullYear();

let currentUser = null;
let conversation = null;
let messagesSubscription = null;
let presenceChannel = null;
let typingTimer = null;
let isSending = false;

const STORAGE = {
  name: "fitforge_visitor_name",
  goal: "fitforge_fitness_goal",
  conversationId: "fitforge_conversation_id"
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function setProfileStatus(message, kind = "") {
  profileStatus.textContent = message;
  profileStatus.className = `form-status ${kind}`;
}

function setChatVisible(visible) {
  if (visible) {
    profile.classList.add("profile-completed");
    chatPanel.classList.remove("hidden");
  } else {
    profile.classList.remove("profile-completed");
    chatPanel.classList.add("hidden");
  }
}

function formatTime(dateString) {
  const d = new Date(dateString);

  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderMessages(rows) {
  if (!rows.length) {
    chatMessages.innerHTML = `
      <div class="chat-empty">
        <div>🏋️</div>
        <strong>Your coaching chat starts here.</strong>
        <span>Send your first message.</span>
      </div>
    `;

    return;
  }

  chatMessages.innerHTML = rows.map((row) => {
    const mine =
      row.sender_id === currentUser?.id;

    const type =
      mine ? "visitor" : "trainer";

    const receipt = mine
      ? `
        <span class="seen ${row.seen_at ? "read" : ""}">
          ${row.seen_at ? "✓✓" : "✓"}
        </span>
      `
      : "";

    return `
      <div
        class="msg ${type}"
        data-message-id="${row.id}"
      >
        ${escapeHtml(row.message)}

        <div class="msg-meta">
          <span>${formatTime(row.created_at)}</span>
          ${receipt}
        </div>
      </div>
    `;
  }).join("");

  requestAnimationFrame(() => {
    chatMessages.scrollTop =
      chatMessages.scrollHeight;
  });
}

async function ensureAnonymousUser() {
  const {
    data: sessionData
  } = await sb.auth.getSession();

  if (sessionData.session?.user) {
    currentUser =
      sessionData.session.user;

    return currentUser;
  }

  const {
    data,
    error
  } = await sb.auth.signInAnonymously();

  if (error) {
    throw error;
  }

  currentUser = data.user;

  return currentUser;
}

async function findOrCreateConversation(
  name,
  goal
) {
  const {
    data: existing,
    error: existingError
  } = await sb
    .from("conversations")
    .select(
      "id, visitor_id, status, created_at, visitor_name, fitness_goal"
    )
    .eq("visitor_id", currentUser.id)
    .eq("status", "open")
    .order("created_at", {
      ascending: false
    })
    .limit(1);

  if (existingError) {
    throw existingError;
  }

  if (existing?.length) {
    return existing[0];
  }

  const {
    data,
    error
  } = await sb
    .from("conversations")
    .insert({
      visitor_id: currentUser.id,
      status: "open",
      visitor_name: name,
      fitness_goal: goal
    })
    .select(
      "id, visitor_id, status, created_at, visitor_name, fitness_goal"
    )
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function loadConversationMessages() {
  if (!conversation) {
    return;
  }

  const {
    data,
    error
  } = await sb
    .from("messages")
    .select(
      "id, conversation_id, sender_id, sender_type, message, created_at, seen_at"
    )
    .eq(
      "conversation_id",
      conversation.id
    )
    .order("created_at", {
      ascending: true
    });

  if (error) {
    throw error;
  }

  renderMessages(data || []);

  const trainerMessages =
    (data || []).filter(
      m =>
        m.sender_id !== currentUser.id &&
        !m.seen_at
    );

  for (const row of trainerMessages) {
    try {
      await sb.rpc(
        "mark_message_seen",
        {
          p_message_id: row.id
        }
      );
    } catch (_) {}
  }

  if (conversation.status === "closed") {
    conversationStatus.textContent =
      "Conversation closed by trainer";

    chatInput.disabled = true;
    chatSendBtn.disabled = true;

    chatInput.placeholder =
      "This conversation is closed.";
  } else {
    conversationStatus.textContent =
      "Conversation open";

    chatInput.disabled = false;
    chatSendBtn.disabled = false;

    chatInput.placeholder =
      "Ask about workouts, nutrition, or your goal…";
  }
}

function stopRealtime() {
  if (messagesSubscription) {
    sb.removeChannel(
      messagesSubscription
    );

    messagesSubscription = null;
  }

  if (presenceChannel) {
    sb.removeChannel(
      presenceChannel
    );

    presenceChannel = null;
  }
}

async function setupRealtime() {
  stopRealtime();

  if (!conversation) {
    return;
  }

  messagesSubscription = sb
    .channel(
      `visitor-messages-${conversation.id}`
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter:
          `conversation_id=eq.${conversation.id}`
      },
      async () => {
        try {
          await loadConversationMessages();
        } catch (error) {
          console.error(error);
        }
      }
    )
    .subscribe();

  presenceChannel =
    sb.channel(
      `conversation:${conversation.id}`,
      {
        config: {
          presence: {
            key: currentUser.id
          }
        }
      }
    );

  presenceChannel.on(
    "presence",
    {
      event: "sync"
    },
    updatePresenceStatus
  );

  presenceChannel.on(
    "presence",
    {
      event: "join"
    },
    updatePresenceStatus
  );

  presenceChannel.on(
    "presence",
    {
      event: "leave"
    },
    updatePresenceStatus
  );

  presenceChannel.on(
    "broadcast",
    {
      event: "typing"
    },
    ({ payload }) => {

      if (payload?.role === "trainer") {

        const isTyping =
          Boolean(payload.typing);

        typingRow.classList.toggle(
          "show",
          isTyping
        );

        clearTimeout(
          typingRow.hideTimer
        );

        if (isTyping) {
          typingRow.hideTimer =
            setTimeout(
              () =>
                typingRow.classList.remove(
                  "show"
                ),
              2200
            );
        }
      }
    }
  );

  await presenceChannel.subscribe(
    async status => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({
          role: "visitor",
          typing: false,
          at: Date.now()
        });
      }
    }
  );
}

function updatePresenceStatus() {
  if (!presenceChannel) {
    return;
  }

  const state =
    presenceChannel.presenceState();

  const people =
    Object.values(state).flat();

  const trainerOnline =
    people.some(
      person =>
        person.role === "trainer"
    );

  coachStatus.textContent =
    trainerOnline
      ? "Coach online"
      : "Coach available";

  coachStatusDot.classList.toggle(
    "offline",
    !trainerOnline
  );
}

async function broadcastTyping(
  isTyping
) {
  if (!presenceChannel) {
    return;
  }

  try {
    await presenceChannel.track({
      role: "visitor",
      typing: isTyping,
      at: Date.now()
    });

    await presenceChannel.send({
      type: "broadcast",
      event: "typing",
      payload: {
        role: "visitor",
        typing: isTyping
      }
    });
  } catch (_) {}
}

async function sendMessage(text) {
  if (
    !conversation ||
    conversation.status === "closed" ||
    isSending
  ) {
    return;
  }

  const clean = text.trim();

  if (!clean) {
    return;
  }

  isSending = true;

  chatSendBtn.disabled = true;

  try {

    const {
      error
    } = await sb
      .from("messages")
      .insert({
        conversation_id:
          conversation.id,

        sender_id:
          currentUser.id,

        sender_type:
          "visitor",

        message:
          clean
      });

    if (error) {
      throw error;
    }

    chatInput.value = "";

    await broadcastTyping(false);

  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Message could not be sent."
    );

  } finally {

    isSending = false;

    chatSendBtn.disabled = false;
  }
}

async function openConversation(
  name,
  goal
) {
  setProfileStatus(
    "Connecting to your secure coaching chat…"
  );

  try {

    await ensureAnonymousUser();

    conversation =
      await findOrCreateConversation(
        name,
        goal
      );

    localStorage.setItem(
      STORAGE.name,
      name
    );

    localStorage.setItem(
      STORAGE.goal,
      goal
    );

    localStorage.setItem(
      STORAGE.conversationId,
      conversation.id
    );

    setChatVisible(true);

    await loadConversationMessages();

    await setupRealtime();

    setProfileStatus(
      "Connected",
      "success"
    );

    showToast(
      "Your coaching chat is ready."
    );

    chatInput.focus();

  } catch (error) {

    console.error(error);

    setProfileStatus(
      error.message ||
      "Could not connect. Please try again.",
      "error"
    );

    showToast(
      "Could not start the chat."
    );
  }
}

async function restoreVisitorSession() {

  const name =
    localStorage.getItem(
      STORAGE.name
    );

  const goal =
    localStorage.getItem(
      STORAGE.goal
    );

  const conversationId =
    localStorage.getItem(
      STORAGE.conversationId
    );

  if (
    !name ||
    !goal ||
    !conversationId
  ) {
    return;
  }

  try {

    await ensureAnonymousUser();

    const {
      data,
      error
    } = await sb
      .from("conversations")
      .select(
        "id, visitor_id, status, created_at, visitor_name, fitness_goal"
      )
      .eq(
        "id",
        conversationId
      )
      .eq(
        "visitor_id",
        currentUser.id
      )
      .single();

    if (
      error ||
      !data
    ) {
      return;
    }

    conversation = data;

    document.getElementById(
      "visitorName"
    ).value =
      data.visitor_name ||
      name;

    document.getElementById(
      "fitnessGoal"
    ).value =
      data.fitness_goal ||
      goal;

    setChatVisible(true);

    await loadConversationMessages();

    await setupRealtime();

  } catch (error) {
    console.error(error);
  }
}

profileForm?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const name =
      document.getElementById(
        "visitorName"
      ).value.trim();

    const goal =
      document.getElementById(
        "fitnessGoal"
      ).value;

    if (!name || !goal) {
      return;
    }

    await openConversation(
      name,
      goal
    );
  }
);

chatForm?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    await sendMessage(
      chatInput.value
    );
  }
);

chatInput?.addEventListener(
  "input",
  async () => {

    await broadcastTyping(
      Boolean(
        chatInput.value.trim()
      )
    );

    clearTimeout(
      typingTimer
    );

    if (
      chatInput.value.trim()
    ) {
      typingTimer =
        setTimeout(
          () =>
            broadcastTyping(false),
          1200
        );
    }
  }
);

resetProfileBtn?.addEventListener(
  "click",
  () => {

    stopRealtime();

    conversation = null;

    localStorage.removeItem(
      STORAGE.conversationId
    );

    setChatVisible(false);

    showToast(
      "Profile form is ready."
    );
  }
);

navToggle?.addEventListener(
  "click",
  () =>
    navLinks.classList.toggle(
      "open"
    )
);

navLinks?.querySelectorAll("a")
  .forEach(a =>
    a.addEventListener(
      "click",
      () =>
        navLinks.classList.remove(
          "open"
        )
    )
  );

const revealObserver =
  new IntersectionObserver(
    entries => {

      entries.forEach(
        entry => {

          if (
            entry.isIntersecting
          ) {
            entry.target.classList.add(
              "revealed"
            );
          }

        }
      );

    },
    {
      threshold: 0.12
    }
  );

document
  .querySelectorAll(".reveal")
  .forEach(el =>
    revealObserver.observe(el)
  );

sb.auth.onAuthStateChange(
  (event, session) => {

    if (session?.user) {
      currentUser =
        session.user;
    }
  }
);

restoreVisitorSession();