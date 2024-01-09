// ==UserScript==
// @name        TankTrouble Development Library
// @author      commander
// @namespace   https://github.com/asger-finding/tanktrouble-userscripts
// @version     0.0.6
// @license     GPL-3.0
// @description Shared library for TankTrouble userscript development
// @match       *://*.tanktrouble.com/*
// @grant       none
// @run-at      document-start
// @noframes
// ==/UserScript==

/* eslint-disable no-unused-vars */

class Loader {

	/**
	 * Pass a function to a hook with the correct context
	 * @param context Function context (e.g `window`)
	 * @param funcName Function identifier in the context
	 * @param hook Hook to call before the original
	 * @param attributes Optionally additional descriptors
	 */
	static hookFunction(context, funcName, hook, attributes) {
		const original = Reflect.get(context, funcName);
		if (typeof original !== 'function') throw new Error('Item passed is not typeof function');

		Reflect.defineProperty(context, funcName, {
			/**
			 * Call the hook with the original function bound to its context
			 * and supply with the arguments list
			 * @param args Arguments passed from outside
			 * @returns Original function return value
			 */
			value: (...args) => hook(original.bind(context), ...args),
			...attributes
		});
	}

	/**
	 * Fires when the `main()` function is done on TankTrouble.
	 * @returns Promise that resolves when Content.init() finishes
	 */
	static whenContentInitialized() {
		if (GM.info.script.runAt !== 'document-start') return Loader.#hookContentInit();
		return whenContentLoaded().then(() => Loader.#hookContentInit());
	}

	/**
	 * Fires when the document is readyState `interactive` or `complete`
	 * @returns Promise that resolves upon content loaded
	 */
	static whenContentLoaded() {
		return new Promise(resolve => {
			if (document.readyState === 'interactive' || document.readyState === 'complete') resolve();
			else document.addEventListener('DOMContentLoaded', () => resolve());
		});
	}

	/**
	 * Apply a hook to the Content.init function which resolves when the promise ends
	 * @returns Promise when Content.init has finished
	 * @private
	 */
	static #hookContentInit() {
		return new Promise(resolve => {
			Loader.hookFunction(Content, 'init', (original, ...args) => {
				const result = original(...args);

				resolve();
				return result;

			// Allow overriding so the event
			// listeners can bubble up
			}, { configurable: true });
		});
	}

}
