// ==UserScript==
// @name        Emporium Wallet
// @author      commander
// @description Show your currency in Dimitri's Emporium
// @namespace   https://github.com/asger-finding/tanktrouble-userscripts
// @version     0.0.3
// @license     GPL-3.0
// @match       *://*.tanktrouble.com/*
// @exclude     *://classic.tanktrouble.com/
// @run-at      document-end
// @grant       GM_addStyle
// @require     https://update.greasyfork.org/scripts/482092/1309109/TankTrouble%20Development%20Library.js
// @noframes
// ==/UserScript==

GM_addStyle(`
.walletIcon {
  object-fit: contain;
  margin-right: 6px;
}
`);

Loader.interceptFunction(TankTrouble.VirtualShopOverlay, '_initialize', (original, ...args) => {
	original(...args);

	TankTrouble.VirtualShopOverlay.walletGold = $("<div><button class='medium disabled' style='display: flex;'>Loading ...</button></div>");
	TankTrouble.VirtualShopOverlay.walletDiamonds = $("<div><button class='medium disabled' style='display: flex;'>Loading ...</button></div>");
	TankTrouble.VirtualShopOverlay.navigation.append([TankTrouble.VirtualShopOverlay.walletGold, TankTrouble.VirtualShopOverlay.walletDiamonds]);
});

Loader.interceptFunction(TankTrouble.VirtualShopOverlay, 'show', (original, ...args) => {
	original(...args);

	const [params] = args;
	Backend.getInstance().getCurrency(result => {
		if (typeof result === 'object') {
			const goldButton = TankTrouble.VirtualShopOverlay.walletGold.find('button').empty();
			const diamondsButton = TankTrouble.VirtualShopOverlay.walletDiamonds.find('button').empty();

			Utils.addImageWithClasses(goldButton, 'walletIcon', 'assets/images/virtualShop/gold.png');
			goldButton.append(result.getGold());
			Utils.addImageWithClasses(diamondsButton, 'walletIcon', 'assets/images/virtualShop/diamond.png');
			diamondsButton.append(result.getDiamonds());
		}
	}, () => {}, () => {}, params.playerId, Caches.getCurrencyCache());
});
