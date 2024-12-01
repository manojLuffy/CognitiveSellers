function e(text) {
	console.log(`%c${text}`, "color: blue; font-weight: bold;");
}

// Initialize Poshmark connection status from storage
let poshmarkConnected = false;
let poshmarkUserName = "";
let facebookConnected = false;
let facebookUserName = "";

chrome.storage.local.get("facebook", (data) => {
	facebookConnected = data?.facebook || false;
});

chrome.storage.local.get("facebookUserName", (data) => {
	console.log("facebookUserName", data?.facebookUserName);
	facebookUserName = data?.facebookUserName || "";
});

chrome.storage.local.get("poshmarkUserName", (data) => {
	console.log("198465", data?.poshmarkUserName);
	poshmarkUserName = data?.poshmarkUserName || "";
});

console.log("19645", facebookUserName, poshmarkUserName);

function cleanUrlData(url) {
	// Parse the URL to extract the query parameters
	const urlParams = new URLSearchParams(new URL(url).search);

	// Get the 'data' parameter and decode it
	const encodedData = urlParams.get("data");
	const decodedData = decodeURIComponent(encodedData);

	// Parse the decoded data into a JSON object
	const jsonData = JSON.parse(decodedData);

	return jsonData;
}

const urlArray = ["https://www.cognitionseller.com/*", "https://cognitionseller.com/*", "http://localhost:3000/*"];

// For checking and updating poshmark login
chrome.webRequest.onCompleted.addListener(
	function (details) {
		// Inspect the request URL and headers
		const urlJson = cleanUrlData(details?.url);
		const isLoggedIn = urlJson.events[0]?.user_id ? true : false;

		chrome.storage.local.set({ poshmark: isLoggedIn });

		chrome.tabs.query({ url: urlArray }, (tabs) => {
			tabs?.forEach((tab) => {
				chrome.tabs.sendMessage(tab.id, {
					action: "marketPlaceLoginStatus",
					marketplace: "poshmark",
					isLoggedIn: urlJson.events[0]?.user_id ? true : false,
					userName: poshmarkUserName || "",
				});
			});
		});
	},
	{ urls: ["*://poshmark.com/trck/events*"] },
	["responseHeaders"]
);

// Listen for changes to tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === "complete" && tab.url.includes("poshmark.com")) {
		console.log("tabId876", tabId);
		// Inject content script if not already injected
		chrome.tabs.executeScript(tabId, { file: "content.js" }, () => {
			// Send message to check login status
			chrome.tabs.sendMessage(tabId, { action: "checkPoshmarkConnection" });
		});
	}

	if (changeInfo.status === "complete" && tab.url.includes("facebook.com")) {
		console.log("tabId876", tabId);
		// Inject content script if not already injected
		chrome.tabs.executeScript(tabId, { file: "content.js" }, () => {
			// Send message to check login status
			chrome.tabs.sendMessage(tabId, { action: "checkFacebookConnection" });
		});
	}

	// if (changeInfo.status === "complete" && (tab.url.includes("localhost") || tab.url.includes("cognitionseller.com"))) {
	if (changeInfo.status === "complete" && urlArray.some((url) => tab.url.includes(url.split("*")[0]))) {
		chrome.storage.local.get("poshmark", (data) => {
			poshmarkConnected = data.poshmark;
			chrome.tabs.sendMessage(tabId, {
				action: "marketPlaceLoginStatus",
				marketplace: "poshmark",
				isLoggedIn: data.poshmark,
				userName: poshmarkUserName || "",
			});
		});

		chrome.storage.local.get("facebook", (data) => {
			facebookConnected = data.facebook;
			chrome.tabs.sendMessage(tabId, {
				action: "marketPlaceLoginStatus",
				marketplace: "facebook",
				isLoggedIn: data.facebook,
				userName: facebookUserName || "",
			});
		});
	}
});

// Function to check the login status from storage
function checkLoginStatus(callback) {
	chrome.storage.local.get("isLoggedIn", function (data) {
		callback(data.isLoggedIn);
	});
}

const tabStatuses = {};
const resolvedTabs = new Set();

// Function to create and wait for a new tab to be ready
async function createTabReady(href, active = false) {
	return new Promise(async (resolve) => {
		let newTab;
		while (!newTab) {
			newTab = await new Promise((resolve) =>
				chrome.tabs.create({ active, url: href }, (tab) => {
					resolve(tab);
				})
			);
			if (!newTab) await wait(10);
		}

		const tabId = newTab.id;

		console.log("tabId", tabId);
		tabStatuses[tabId] = false;

		const intervalId = setInterval(async () => {
			if (!newTab) return;

			let result = await loadAndRemove("tabReady" + newTab.id);
			console.log("result", result);
			if (result) {
				clearInterval(intervalId); // Clear interval when tab is ready
				tabStatuses[tabId] = true;
				resolve(newTab);
			}
		}, 500);
	});
}

// Function to change the product_tags field to keywords
function updateObjectField(obj) {
	const newObj = { ...obj, keywords: obj.product_tags };
	delete newObj.product_tags;
	return newObj;
}
// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
	e("Request from content:", request);

	if (request.action === "openNewTab") {
		const { url, marketplace } = request;
		const tab = await createTabReady(url, true);

		const modifiedListingData = updateObjectField(request.listingData);

		console.log("15344", tab);

		const intervalId = setInterval(() => {
			if (tabStatuses[tab.id]) {
				const port = chrome.tabs.connect(tab.id);
				console.log("modifiedListingData143", modifiedListingData);
				port.postMessage({ action: "fillListingData", data: modifiedListingData, marketplace: marketplace, tab: tab });
				port.onMessage.addListener((response) => {
					console.log("Response from content script:", response);
					if (response?.status) clearInterval(intervalId);
					// Handle response from content script
				});
			}
		}, 2500);

		// return true; // Indicate asynchronous response
	}

	if (request.action === "importListings") {
		const { marketplace, url } = request;

		e("Importing listings from:", marketplace);

		if (marketplace === "poshmark") {
			const tab = await createTabReady(url, true);

			const intervalId = setInterval(() => {
				if (tabStatuses[tab.id]) {
					const port = chrome.tabs.connect(tab.id);

					port.postMessage({ action: "poshmarkFeedPageReady", marketplace: marketplace });
					let listingData123;
					port.onMessage.addListener((response) => {
						if (response.action === "poshmarkClosetURL") {
							clearInterval(intervalId);
							console.log("Received closet URL:", response.url);
							if (response.url) {
								console.log("Navigating to closet URL:", response.url);

								// 4. Update the tab URL to the closet URL
								chrome.tabs.update(tab.id, { url: response.url }, () => {
									// 5. Now that the closet page is loaded,
									// send a message to extract the listings
									const closetTabIntervalId = setInterval(() => {
										if (tabStatuses[tab.id]) {
											const port = chrome.tabs.connect(tab.id);
											console.log("tab187", tab);
											port.postMessage({ action: "enterPoshmarkListingSelectionMode" });
											port.onMessage.addListener((response) => {
												if (response.action === "poshmarkListingSelectionUIAdded") {
													console.log("Listings extracted987:", response);
													clearInterval(closetTabIntervalId);
												}

												if (response.action === "poshmarkListingsSelectedData") {
													console.log("10958", response);
													chrome.tabs.query({ url: urlArray }, (tabs) => {
														tabs?.forEach((tab) => {
															chrome.tabs.sendMessage(tab.id, { action: "poshmarkListingsReady", listings: response.listings });
														});
													});
													chrome.tabs.remove(tab.id);
												}
											});
										}
									}, 500);
								});
							} else {
								console.error("Error getting closet URL:", response.error);
								sendResponse({ status: "Error getting closet URL" }); // Indicate error
							}
						}
					});
					port.postMessage({ action: "test123", data: listingData123 });
				}
			}, 500);

			if (tab) {
				// Send a message to the new tab
				const port = chrome.tabs.connect(tab.id);
				console.log("port", port);
				port.postMessage({ action: "poshmarkFeedPageReady", marketplace: marketplace });

				// Listen for response from the new tab
				port.onMessage.addListener((response) => {
					if (response.action === "poshmarkClosetURL") {
						console.log("Received closet URL:", response.url);
						if (response.url) {
							console.log("Navigating to closet URL:", response.url);

							// 4. Update the tab URL to the closet URL
							chrome.tabs.update(tab.id, { url: response.url }, () => {
								// 5. Now that the closet page is loaded,
								// send a message to extract the listings
								chrome.tabs.sendMessage(tab.id, { action: "extractPoshmarkListings" });
							});
						} else {
							console.error("Error getting closet URL:", response.error);
							sendResponse({ status: "Error getting closet URL" }); // Indicate error
						}
					}
				});
			} else {
				sendResponse({ status: "Error opening marketplace listings page" });
			}
		}

		if (marketplace === "facebook") {
			const tab = await createTabReady(url, true);

			const intervalId = setInterval(() => {
				if (tabStatuses[tab.id]) {
					const port = chrome.tabs.connect(tab.id);
					console.log("port", port);
					port.postMessage({ action: "extractFacebookListings", marketplace: marketplace });
					port.onMessage.addListener(async (response) => {
						console.log("Response from content script165:", response);
						if (response.action === "facebookListingLinksExtracted") {
							clearInterval(intervalId);

							console.log("104343", response);
							const { listingLinks } = response;
							console.log("Received listing links:1065", listingLinks);

							const listingData = []; // Array to store all extracted listing data

							// Iterate through each listing link
							for (let i = 0; i < listingLinks.length; i++) {
								const listingURL = listingLinks[i];
								console.log("1065", listingLinks);
								try {
									// Extract data from the listing page
									const extractedData = await extractFacebookListingData(listingURL);

									console.log("Extracted data1673:", extractedData);
									listingData.push(extractedData);
								} catch (error) {
									console.error(`Error extracting data for listing ${listingURL}:`, error);
								}
							}

							chrome.tabs.query({ url: urlArray }, (tabs) => {
								tabs?.forEach((tab) => {
									chrome.tabs.sendMessage(tab.id, { action: "facebookListingsReady", listings: listingData });
								});
							});
							//close marketplace page
							chrome.tabs.remove(tab.id);
							console.log("All extracted Facebook listing data:7988", listingData);
						}
						// Handle response from content script
					});
				}
			}, 500);
		}
		return true;
	}

	if (request.action === "checkLoginStatusByOpeningAndClosingTab") {
		const { marketplace } = request;

		if (marketplace === "poshmark") {
			// Open Poshmark homepage in a new tab
			const tab = await createTabReady("https://poshmark.com", true);

			const intervalId = setInterval(() => {
				if (tabStatuses[tab.id]) {
					const port = chrome.tabs.connect(tab.id);
					console.log("port", port);
					port.postMessage({ action: "checkMarketplaceConnectionAndClose", marketplace: marketplace });
					port.onMessage.addListener((response) => {
						console.log("Response from content script:", response);
						if (response) clearInterval(intervalId);
						// chrome.tabs.remove(tab.id);
						// Handle response from content script
					});
				}
			}, 500);

			return true; // Indicate asynchronous response
		}

		if (marketplace === "facebook") {
			// Open facebook homepage in a new tab
			const tab = await createTabReady("https://facebook.com", true);

			const intervalId = setInterval(() => {
				if (tabStatuses[tab.id]) {
					const port = chrome.tabs.connect(tab.id);
					console.log("port", port);
					port.postMessage({ action: "checkMarketplaceConnectionAndClose", marketplace: marketplace });
					port.onMessage.addListener((response) => {
						console.log("Response from content script:", response);
						if (response) clearInterval(intervalId);
						// chrome.tabs.remove(tab.id);
						// Handle response from content script
					});
				}
			}, 500);
		}
	}

	if (request.action === "saveAndSendMarketplaceLoginStatus") {
		let userNameKey = `${request.marketplace}UserName`;
		console.log("Request received:1543", userNameKey);

		// Store the updated status in storage
		chrome.storage.local.set({ [request.marketplace]: request.isLoggedIn, [userNameKey]: request.userName });
		chrome.tabs.query({ url: urlArray }, (tabs) => {
			tabs?.forEach((tab) => {
				chrome.tabs.sendMessage(tab.id, {
					action: "marketPlaceLoginStatus",
					marketplace: request.marketplace,
					isLoggedIn: request.isLoggedIn,
					userName: request.userName || "",
				});
			});
		});
	}

	if (request.action === "savePoshmarkUsername") {
		console.log("09576", request.userName);
		chrome.storage.local.set({ poshmarkUserName: request.userName || "" });
		chrome.tabs.query({ url: urlArray }, (tabs) => {
			tabs.forEach((tab) => {
				chrome.tabs.sendMessage(tab.id, {
					action: "marketPlaceLoginStatus",
					marketplace: "poshmark",
					isLoggedIn: true,
					userName: request.userName || "",
				});
			});
		});
	}

	if (request.action === "poshmarkListingsSelected") {
		console.log("Listings selected10743", request);
	}

	if (request.action === "disconnectMarketplace") {
		console.log("Request received:1543", request);
		let userNameKey = `${request.marketplace}UserName`;
		// Store the updated status in storage
		chrome.storage.local.set({ [request.marketplace]: false, [userNameKey]: "" });
		chrome.tabs.query({ url: urlArray }, (tabs) => {
			tabs.forEach((tab) => {
				chrome.tabs.sendMessage(tab.id, {
					action: "marketPlaceLoginStatus",
					marketplace: request.marketplace,
					isLoggedIn: false,
				});
			});
		});
	}
});

// Function to extract Facebook listing data (using a single tab)
async function extractFacebookListingData(listingURL) {
	// console.log("listingURL098", listingURL);
	return new Promise(async (resolve, reject) => {
		try {
			const tab = await createTabReady(listingURL, true);

			const intervalId = setInterval(() => {
				if (tabStatuses[tab.id]) {
					const port = chrome.tabs.connect(tab.id);
					port.postMessage({ action: "extractFacebookListingData", url: listingURL });
					port.onMessage.addListener((response) => {
						console.log("Response from content script9088:", response);
						if (response.action === `facebookListingDataExtractedFor${listingURL}`) {
							clearInterval(intervalId);
							resolve(response);
							chrome.tabs.remove(tab.id);
						}
						// Handle response from content script
					});
				}
			}, 500);
		} catch (error) {
			console.error("Error in extractFacebookListingData:", error);
			reject(error);
		}
	});
}

async function loadAndRemove(name) {
	const tabId = name.replace("tabReady", "");
	if (resolvedTabs.has(tabId)) {
		return false; // Don't re-resolve if already done
	}
	console.log("beforeLoad", name);
	await save({ [name]: true });
	const answer = await load(name);
	console.log("afterLoad", answer);
	if (answer) {
		await remove(name);
		resolvedTabs.add(tabId); // Mark tab as resolved
		return answer;
	} else {
		return undefined;
	}
}

// Helper function to get the active tab
async function getActiveTab() {
	return new Promise((resolve) => {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			resolve(tabs[0]);
		});
	});
}

// ... Storage helper functions (same as in popup.js)
const STORAGE = chrome.storage.local;

async function save(obj) {
	return new Promise((resolve, reject) => {
		STORAGE.set(obj, () => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(true);
			}
		});
	});
}

async function load(name) {
	return new Promise((resolve, reject) => {
		STORAGE.get(name, (answer) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(answer[name] ?? undefined);
			}
		});
	});
}

async function remove(name) {
	return new Promise((resolve, reject) => {
		STORAGE.remove(name, () => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(true);
			}
		});
	});
}
