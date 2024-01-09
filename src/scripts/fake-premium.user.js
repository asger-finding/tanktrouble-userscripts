// ==UserScript==
// @name        Fake Premium
// @author      commander
// @description Makes the game think you have premium (only visual)
// @namespace   https://github.com/asger-finding
// @version     0.0.1
// @license     GPL-3.0
// @match       *://*.tanktrouble.com/*
// @exclude     *://classic.tanktrouble.com/
// @run-at      document-end
// @grant       none
// @noframes
// ==/UserScript==

const { _updatePremium } = PremiumManager;
PremiumManager.classFields({
	get _updatePremium() {
		_updatePremium(true);
		return () => {};
	},
	set _updatePremium(value) {
		return value;
	}
});
