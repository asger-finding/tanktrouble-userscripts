// ==UserScript==
// @name        Better TankTrouble Chatbox
// @author      commander
// @description Redesigned chatbox meant both for power users, and those who maybe just wants something new
// @namespace   https://github.com/asger-finding/tanktrouble-userscripts
// @version     0.1.3
// @license     GPL-3.0
// @match       *://*.tanktrouble.com/*
// @exclude     *://classic.tanktrouble.com/
// @run-at      document-end
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @require     https://update.greasyfork.org/scripts/482092/1309109/TankTrouble%20Development%20Library.js
// @noframes
// ==/UserScript==

// TODO: whisper suggestions when pressing @ ?

GM_addStyle(`
#chat {
  /*Move it to the bottom left*/
  inset: calc(100% - 30px) auto auto 34px !important;
  /*Disable drop shadow filter*/
  filter: none;
  -webkit-filter: none;
}
/*Reverse the chat flow*/
#chat,
#chat .content,
#chat .body {
  display: flex;
  flex-direction: column-reverse;
}
#chat .status.button {
  transform: translate(7px, -18px);
  cursor: initial;
  z-index: 1;
}
#chat form {
  width: 200px;
  margin-left: 20px;
  background: #ececec;
}
#chat form[style*="repeating-linear-gradient"] {
  background: #d0d0d0 !important;
}
#chat:not(.open) form {
  display: none;
}
#chat textarea {
  left: 5px;
  transition: width 0s !important;
  width: calc(100% - 12px);
}
#chat .body {
  padding-right: 10px;
  border-radius: 3px;
  background: linear-gradient(225deg, #00000005 12px, #00000014 12px, #00000014 100%);
  margin-bottom: 7px;
  top: 0 !important;
  -webkit-mask-image: linear-gradient(225deg, #000000 11px, #00000000 12px, #00000000 100% ),
	linear-gradient(to top, #000000 70%, rgba(0, 0, 0, 0.11));
}
#chat .body .chatMessage svg {
  padding: 2px 4px 1px 4px;
  border-left: 2px dotted rgb(170, 170, 170);
}
#chat .body.dragging {
  border: none !important;
  margin-left: 20px !important;
}
/*Rotate and align the handle to top-right*/
.handle.ui-resizable-ne[src*="resizeHandleBottomRight.png"] {
  width: 12px;
  height: 12px !important;
  transform: translateX(6px) rotate(-90deg);
  z-index: 2147483647;
  position: sticky;
  left: calc(100% - 7px);
  top: 0;
  order: 0;
  margin-bottom: auto !important;
}
body:has(#chat .body.ui-resizable-resizing) .ui-resizable-handle.handle.ui-resizable-ne {
  display: none !important;
}

/* Scrollbar */
#chat .body {
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgb(170, 170, 170) transparent;
  align-items: end;
  direction: rtl;
  pointer-events: auto;
  overflow-x: hidden;
  overflow-y: hidden;
}
#chat .body:hover {
  overflow-y: scroll;
}
#chat .body .chatMessage {
  direction: ltr;
  margin-left: ${(/Chrome.*Safari/u).test(navigator.userAgent) ? '3px' : '5px'};
}
#chat .body::-webkit-scrollbar {
  width: 3px;
}
#chat .body::-webkit-scrollbar-track {
  background: transparent;
}
#chat .body::-webkit-scrollbar-thumb {
  background: rgb(170, 170, 170);
}
`);

// Initialize dynamic stylesheet
// for user-defined chat width
const inputWidth = new CSSStyleSheet();
inputWidth.insertRule('#chat form { padding-right: 12px !important; }', 0);
inputWidth.insertRule('#chat form, #chat textarea { width: 208px !important; }', 1);
document.adoptedStyleSheets = [inputWidth];

/**
 * Reconfigure the chat handle to be dragging
 * from the south-east direction (down)
 * to the north-east direction (up)
 */
const changeHandleDirection = () => {
	const { resizable } = $.fn;

	// Use a regular function to keep context
	$.fn.resizable = function(...args) {
		const [config] = args;

		// Reassign the chat handle to be north-east facing
		if (config.handles) {
			const handle = config.handles.se;
			if (handle === TankTrouble.ChatBox.chatBodyResizeHandle) {
				handle.removeClass('ui-resizable-se')
					.addClass('ui-resizable-ne');

				config.handles.ne = handle;
				delete config.handles.se;

				// Set a taller chat maxHeight
				config.maxHeight = 650;
			}
		}

		return resizable.call(this, config);
	};
};

/**
 * Hook message render functions to disable jquery .show() animation and scroll to bottom
 * This fixes chat messages not showing up in the reversed chat order or overflowed messages being cleared
 */
const fixChatRendering = () => {
	Loader.interceptFunction(TankTrouble.ChatBox, '_renderChatMessage', (original, ...args) => {
		TankTrouble.ChatBox.chatBody.scrollTop(TankTrouble.ChatBox.chatBody.height());

		// Set animateHeight to false
		args[9] = false;
		original(...args);
	});

	Loader.interceptFunction(TankTrouble.ChatBox, '_renderSystemMessage', (original, ...args) => {
		TankTrouble.ChatBox.chatBody.scrollTop(TankTrouble.ChatBox.chatBody.height());

		// Set animateHeight to false
		args[3] = false;
		original(...args);
	});
};

/**
 * Prevent TankTrouble from clearing the chat when the client disconnects
 * Print message to chat when client switches server to separate conversations
 */
const preventChatClear = () => {
	Loader.interceptFunction(TankTrouble.ChatBox, '_clearChat', (original, ...args) => {
		const isUnconnected = ClientManager.getClient().getState() === TTClient.STATES.UNCONNECTED;

		// Void the call if the client is unconnected
		// when the function is invoked
		if (isUnconnected) return null;

		return original(...args);
	});

	Loader.interceptFunction(TankTrouble.ChatBox, '_updateStatusMessageAndAvailability', (original, ...args) => {
		const [systemMessageText, guestPlayerIds] = args;

		// Check for welcome message
		// If true, print a system message
		if (systemMessageText === 'Welcome to TankTrouble Comms § § ') {
			const newServer = ClientManager.getAvailableServers()[ClientManager.multiplayerServerId];
			return original(`Connected to ${ newServer.name } ${ guestPlayerIds.length ? '§ ' : '' }`, guestPlayerIds);
		}
		return original(...args);
	});
};

/**
 * Write the chat savestate to storage and return
 * @returns Promise for last savestate
 */
const startChatSavestate = () => {
	Loader.interceptFunction(TankTrouble.ChatBox, 'open', (original, ...args) => {
		GM_setValue('chat-open', true);
		original(...args);
	});
	Loader.interceptFunction(TankTrouble.ChatBox, 'close', (original, ...args) => {
		GM_setValue('chat-open', false);
		original(...args);
	});

	// Get savestate and default to chat being open
	return GM_getValue('chat-open', true);
};

/**
 * Add up/down history for sent messages
 * @param input Input to target
 */
const addInputHistory = input => {
	const messages = [];
	let currentInputValue = input.value;

	// Create and initialize chat messages history iterator
	let i = messages.length;
	const iterator = (function* chatsIterator() {
		while (true) {
			const incOrDec = (yield messages[i]) === 'prev' ? -1 : 1;
			i = Math.min(Math.max(i + incOrDec, 0), messages.length);
		}
	}(messages));

	// Initialize the generator
	iterator.next();

	/**
	 * Check whether or not the input has an empty selection range
	 * @returns Selection range is 0
	 */
	const isSelectionEmpty = () => input.selectionStart === input.selectionEnd;

	/** Handle the user triggering a submit keydown event */
	const handleSubmit = () => {
		if (!input.value) return;

		messages.push(input.value);
		currentInputValue = '';

		i = messages.length;
	};

	/** Handle the user triggering an arrow up keydown event */
	const handleArrowUp = () => {
		if (isSelectionEmpty() && input.selectionStart === 0) {
			const { value } = iterator.next('prev');
			input.value = typeof value === 'undefined' ? '' : value;

			input.setSelectionRange(input.value.length, input.value.length);
			input.dispatchEvent(new Event('input', {}));
		}
	};

	/** Handle the user triggering an arrow down keydown event */
	const handleArrowDown = () => {
		if (isSelectionEmpty() && input.selectionStart === input.value.length) {
			const { value } = iterator.next();
			input.value = typeof value === 'undefined' ? currentInputValue : value;

			input.setSelectionRange(input.value.length, input.value.length);
			input.dispatchEvent(new Event('input', {}));
		}
	};

	// If the user is at the top of the history,
	// save the chat input value as the "current"
	// message whenever there is a change
	input.addEventListener('input', ({ inputType }) => {
		const isAtEndOfHistory = i === messages.length;
		const hasValueChanged = typeof inputType !== 'undefined';
		if (isAtEndOfHistory && hasValueChanged) currentInputValue = input.value;
	});

	// Listen for keydown events
	// and trigger handlers
	input.addEventListener('keydown', ({ key }) => {
		switch (key) {
		case 'Enter':
			handleSubmit();
			break;
		case 'ArrowUp':
			handleArrowUp();
			break;
		case 'ArrowDown':
			handleArrowDown();
			break;
		default:
			break;
		}
	});
};

changeHandleDirection();
fixChatRendering();

Loader.whenContentInitialized().then(async() => {
	preventChatClear();

	const shouldChatOpen = await startChatSavestate();
	if (shouldChatOpen) TankTrouble.ChatBox.open();

	// eslint-disable-next-line prefer-destructuring
	const chatBody = TankTrouble.ChatBox.chatBody[0];
	// eslint-disable-next-line prefer-destructuring
	const chatInput = TankTrouble.ChatBox.chatInput[0];

	addInputHistory(chatInput);

	// Create a mutation observer that looks for changes in the chatBody's attributes (namely width)
	new MutationObserver(() => {
		const width = Number(chatBody.offsetWidth || 220);

		inputWidth.deleteRule(1);
		inputWidth.insertRule(`#chat form, #chat form textarea { width: ${width - 12}px !important; }`, 1);

		chatInput.dispatchEvent(new Event('input', {}));
	}).observe(chatBody, {
		attributes: true,
		characterData: false
	});

	// Allow more characters in the chat input
	chatInput.setAttribute('maxlength', '255');
});
