$(document).ready(async function () {
	const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
	// const waitForNode = (selector, maxWait, inNode) => {
	// 	if (!inNode) {
	// 		if (!document.documentElement) {
	// 			return new Promise((resolve) => {
	// 				let interval = setInterval(() => {
	// 					if (document.documentElement) {
	// 						clearInterval(interval);
	// 						resolve(true);
	// 					}
	// 				}, 10);
	// 			}).then(() => waitForNode(selector, maxWait, document.documentElement));
	// 		}
	// 		inNode = $(document.documentElement);
	// 	}

	// 	let maxDate = null;
	// 	if (maxWait) {
	// 		maxDate = new Date();
	// 		maxDate.setSeconds(maxDate.getSeconds() + maxWait);
	// 	}

	// 	return new Promise((resolve) => {
	// 		let interval = setInterval(() => {
	// 			let node = inNode.find(selector);
	// 			if (node.length > 0) {
	// 				clearInterval(interval);
	// 				resolve(node);
	// 			}
	// 			if (maxDate && new Date() > maxDate) {
	// 				clearInterval(interval);
	// 				resolve(null);
	// 			}
	// 		}, 50);
	// 	});
	// };

	const waitForNode = async (selector, maxWait, inNode = document.documentElement) => {
		const startTime = Date.now();
		const maxTime = maxWait ? startTime + maxWait * 1000 : null;

		while (true) {
			const node = $(inNode).find(selector);
			if (node.length > 0) {
				return node;
			}

			if (maxTime && Date.now() > maxTime) {
				return null;
			}

			await new Promise((resolve) => setTimeout(resolve, 50)); // Wait 50ms
		}
	};

	// Function to check login status and close the tab
	async function checkMarketPlaceLoginStatus(marketplace) {
		console.log("19328", marketplace);
		if (marketplace === "poshmark") {
			const imgElement = await waitForNode(".header__account-info__link .dropdown__selector img", 25); // Wait for image
			console.log("poshmarkFeedPageReady", imgElement);
			if (imgElement && imgElement.length) {
				const userName = imgElement.attr("alt"); // Extract username from img alt
				console.log("username143", userName);
				if (userName) {
					chrome.runtime.sendMessage({
						action: "savePoshmarkUsername",
						userName: userName || "",
					});
				}
			}
		}

		if (marketplace === "facebook") {
			// *** Facebook Marketplace Logic ***
			const loginStorageData = JSON.parse(localStorage.getItem("ares_last_signal_flush"));

			// 1. Find the div with the aria-label "Create a post"
			const usernameDiv = await waitForNode('div[aria-label="Create a post"]', 5);

			let userName;
			console.log("18567", usernameDiv);

			if (usernameDiv && usernameDiv.length > 0) {
				// 2. Extract the username from the aria-label
				const ariaLabel = usernameDiv.find("a").attr("aria-label");
				const username = ariaLabel?.replace(/'s [tT]imeline/, "").trim();
				userName = username;

				console.log("19456", username);
			} else {
				// Handle case where the div is not found
				console.warn("Facebook login element not found!");
				// ... your existing logic for not logged in ...
			}

			console.log("18567", userName, loginStorageData);

			if (loginStorageData) {
				chrome.runtime.sendMessage({
					action: "saveAndSendMarketplaceLoginStatus",
					isLoggedIn: true,
					marketplace: "facebook",
					userName: userName || "",
				});
			} else {
				chrome.runtime.sendMessage({
					action: "saveAndSendMarketplaceLoginStatus",
					isLoggedIn: false,
					marketplace: "facebook",
				});
			}
		}
	}

	// Helper Functions

	window.postMessage({ type: "FROM_EXTENSION", text: "Hello from the extension!" }, "*");
	// Listen for messages from the website component
	window.addEventListener("message", (event) => {
		// We only accept messages from ourselves
		// if (event.source !== window) return;

		// console.log("Message received from website component:1644", event.data);

		console.log("032", event.data);

		if (event.data.type && event.data.type === "FROM_PAGE") {
			if (event.data.action === "copyListing") {
				const { listingId, marketplace, listingData } = event.data;
				console.log("Copy Listing request received for marketplace:", marketplace, "and listing ID:", listingId);

				// Send a message to the background script to handle copying
				if (marketplace === "poshmark") {
					chrome.runtime.sendMessage({
						action: "openNewTab",
						url: "https://poshmark.com/create-listing",
						marketplace: marketplace,
						listingData: listingData,
					});
				} else if (marketplace === "facebook") {
					chrome.runtime.sendMessage({
						action: "openNewTab",
						url: "https://www.facebook.com/marketplace/create/item",
						marketplace: marketplace,
						listingData: listingData,
					});
				}
			}

			if (event.data.action === "importPoshmarkListings") {
				console.log("Import Poshmark listings request received");

				chrome.runtime.sendMessage({
					action: "importListings",
					marketplace: "poshmark",
					page: "home",
					url: "https://poshmark.com/feed",
				});
			}

			if (event.data.action === "importFacebookListings") {
				console.log("Import Facebook listings request received");

				chrome.runtime.sendMessage({
					action: "importListings",
					marketplace: "facebook",
					page: "listings",
					url: "https://www.facebook.com/marketplace/you/selling",
				});
			}

			if (event.data.action === "connectToPoshmark") {
				// Forward the connectToPoshmark message to the background script
				chrome.runtime.sendMessage({
					action: "checkLoginStatusByOpeningAndClosingTab",
					marketplace: "poshmark",
				});
			}

			if (event.data.action === "connectToFacebook") {
				// Forward the connectToFacebook message to the background script
				chrome.runtime.sendMessage({
					action: "checkLoginStatusByOpeningAndClosingTab",
					marketplace: "facebook",
				});
			}

			if (event.data.action === "disconnectMarketplace") {
				// Forward the disconnectFacebook message to the background script
				chrome.runtime.sendMessage({
					action: "disconnectMarketplace",
					marketplace: event.data.marketplace,
				});
			}
		}
	});

	window.waitForNodeDisappear = function (selector, checkingIntervalTime = 50) {
		return new Promise((resolve) => {
			let interval = setInterval(() => {
				let node = typeof selector === "object" ? selector : $(selector);
				if (node.closest(document.documentElement).length === 0) {
					clearInterval(interval);
					resolve(true);
				}
			}, checkingIntervalTime);
		});
	};

	jQuery.fn.dispatch = function (event, obj) {
		try {
			if (this[0] === undefined) throw new Error("cant dispatch, object is empty");
			if (this.length > 1) throw new Error("More that one selected node");
		} catch (error) {
			console.error(error);
			return this;
		}
		if (obj === undefined) obj = {};
		if (obj.bubbles === undefined) obj.bubbles = true;
		if (obj.cancelable === undefined) obj.cancelable = true;
		if (obj.composed === undefined) obj.composed = true;
		let evt;
		if (["keypress", "keyup", "keydown"].indexOf(event) > -1) evt = new KeyboardEvent(event, obj);
		else if (["mouseup", "mousedown", "click", "mousemove"].indexOf(event) > -1) evt = new MouseEvent(event, obj);
		else evt = new Event(event, obj);
		this[0].dispatchEvent(evt);
		return this;
	};

	// In your helper or utility file:
	window.getHttpResponse = async function (url, additionalInit = {}, asBlob = false) {
		// Set default options for the fetch request
		const init = {
			...additionalInit, // Include any additional options passed in
			credentials: "include", // Include cookies in the request
		};

		return fetch(url, init)
			.then(async (response) => {
				if (asBlob) {
					// If the caller wants the response as a blob
					let reader = new FileReader();
					reader.readAsDataURL(await response.blob());
					return new Promise((resolve) => {
						reader.onloadend = function () {
							resolve(reader.result);
						};
					});
				} else {
					// Otherwise, return the response as text
					return response.text();
				}
			})
			.catch((error) => {
				console.error("Error fetching URL:", url, error);
				throw error; // Rethrow the error to be handled by the caller
			});
	};

	window.getDataTransfer = async function (images, modify = {}) {
		const ths = getDataTransfer;
		if (!ths.rndStr) {
			let str = "1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM";
			ths.rndStr = "";
			for (let i = 0; i < 8; i++) ths.rndStr += str[Math.round(Math.random() * str.length)];
		}
		if (!ths.counter) ths.counter = 0;
		if (!ths.uploads) ths.uploads = [];
		let uploadId = ths.uploads.length;
		ths.uploads[uploadId] = true;

		return Promise.all(
			images.map(async (url) => {
				const response = await fetch(url);
				const blob = await response.blob();
				const name = url.split("/").pop().split("#")[0].split("?")[0];
				return new File([blob], name, { type: blob.type });
			})
		).then((files) => {
			let transfer = new DataTransfer();
			files.forEach((file) => transfer.items.add(file));
			ths.uploads[uploadId] = false;
			// if (Math.max(...ths.uploads) === 0) hideMessage().then();
			return transfer.files;
		});
	};

	// *** Poshmark Specific Functions ***

	// *** VERY IMPORTANT ***
	// This function is crucial for Poshmark, as it reveals the listing form
	let isActive = false;
	let autofillInProgress = false; // Flag to prevent multiple calls
	let poshmarkAutofillInProgress = false;
	let extractFacebookListingsInProgress = false; // Flag to prevent multiple calls
	let poshmarkUIAdded = false;

	async function whenActiveReleased(reCopy = false) {
		if (isActive && !recopy) {
			const f = whenActiveReleased;
			if (typeof f.waiters === "undefined") f.waiters = [];
			let thisI = f.waiters.length;
			f.waiters.push(thisI);
			return new Promise((resolve) => {
				window.addEventListener("isActiveReleased", () => {
					if (thisI === f.waiters.length - 1) {
						f.waiters.splice(thisI);
						isActive = true;
						resolve(true);
					}
				});
			});
		} else {
			isActive = true;
			return true;
		}
	}

	function releaseActive() {
		isActive = false;
		dispatchEvent(new Event("isActiveReleased"));
	}

	// Poshmark form field helper function

	// Image preloading (using promises)
	const PRELOADED_IMAGES = {};
	window.getPreloadedImage = async function (url) {
		// 1. Check if the image is already in the cache:
		if (PRELOADED_IMAGES[url]) {
			return PRELOADED_IMAGES[url]; // Return the cached promise
		}

		// 2. Image not in cache, so preload it:
		const promise = fetch(url)
			.then((response) => response.blob())
			.then((blob) => {
				return new Promise((resolve, reject) => {
					const reader = new FileReader();
					reader.onloadend = () => resolve(reader.result);
					reader.onerror = reject;
					reader.readAsDataURL(blob);
				});
			})
			.then((dataURL) => {
				// Extract the base64 part from the data URL
				return dataURL.replace(/^data:image\/(png|jpeg|gif);base64,/, "");
			})
			.catch((error) => {
				console.error("Error preloading image:", url, error);
				return url;
			});

		// 3. Cache the promise
		PRELOADED_IMAGES[url] = promise;

		// 4. Return the promise
		return promise;
	};

	function convertHtmlToText(htmlString) {
		// Create a new DOM element to parse the HTML string
		const tempElement = document.createElement("div");
		tempElement.innerHTML = htmlString;

		// Use textContent to extract the plain text
		return tempElement.textContent || tempElement.innerText || "";
	}

	// Helper function to find an element in a scrollable dropdown
	async function findElementInScrollableDropdown(selector) {
		const dropdownMenu = await waitForNode('div[role="dialog"][aria-label="Dropdown menu"]', 5);

		if (!dropdownMenu) {
			return null; // Dropdown not found
		}

		// Scroll through the dropdown in steps
		const scrollHeight = dropdownMenu[0].scrollHeight;
		const stepSize = 200; // Adjust the step size as needed

		for (let scrollTop = 0; scrollTop <= scrollHeight; scrollTop += stepSize) {
			dropdownMenu.scrollTop(scrollTop);
			await wait(100); // Allow time for scrolling

			const element = $(selector);
			if (element.length > 0) {
				return element; // Element found!
			}
		}

		return null; // Element not found after scrolling
	}

	// Function to autofill the form
	async function autofillForm(dt, marketplace) {
		if (autofillInProgress) {
			console.warn("Autofill is already in progress. Skipping this call.");
			return;
		}
		console.log("Autofill Form called for:", marketplace, autofillInProgress);
		try {
			autofillInProgress = true;
			if (marketplace === "facebook") {
				// *** Facebook Marketplace Logic ***
				const form = await waitForNode(
					// 'div[role="form"][aria-label]:first:has(input[type="file"]), div[role="form"][aria-label="Marketplace"]'
					'div[role="form"][aria-label="Marketplace"]'
				);
				console.log("Facebook form element:", form);

				if (!form.length) {
					console.error("Facebook Marketplace listing form not found!");
					return;
				}

				async function getInputDiv(name) {
					const name1 = name
						.split(" ")
						.map((q) => q[0].toUpperCase() + q.substring(1))
						.join(" ");

					const name2 = name.charAt(0).toUpperCase() + name.slice(1);
					console.log("Input div286:", name1, name2);

					const selector_1 = await waitForNode(`div:has(>span:contains("${name1}")):first`, 1, form);
					const selector_2 = await waitForNode(`label:has(span:contains("${name1}"))`, 1, form);
					const selector_3 = await waitForNode(`label[aria-label="${name1}"]`, 1, form);
					const selector_4 = await waitForNode(`div:has(>span:contains("${name2}")):first`, 1, form);
					const selector_5 = await waitForNode(`label:has(span:contains("${name2}"))`, 1, form);
					const selector_6 = await waitForNode(`label[aria-label="${name2}"]`, 1, form);

					if (selector_3) {
						return selector_3;
					} else if (selector_2) {
						return selector_2;
					} else if (selector_1) {
						return selector_1;
					} else if (selector_4) {
						return selector_4;
					} else if (selector_5) {
						return selector_5;
					} else if (selector_6) {
						return selector_6;
					}
				}

				async function setValue(name, value) {
					let div = await getInputDiv(name);
					console.log("Input div143:", name, div);
					if (!div) {
						return;
					}
					let scrollable = form.parent().parent().parent();
					scrollable.scrollTop(0).scrollTop(div.offset().top - 150);
					let input = div ? div.find("input, textarea") : false;
					if (input && input.length) input.val(value).dispatch("input").dispatch("focusout");
					div.dispatch("click");
					let variants = await waitForNode('div[id][tabindex="-1"][role="option"]:visible', 1);
					if (variants) {
						if (typeof value === "number") variants.eq(value).dispatch("click");
						else {
							value = value.toLowerCase().trim();
							for (let variant of variants) {
								if (variant.innerText.toLowerCase().trim() === value) {
									$(variant).dispatch("click");
									break;
								}
							}
						}
					}
				}

				if (dt.media?.length > 0) {
					const images = form.find('img:not([src^="data"])');
					for (let img of images) {
						$(img).parents(":has(i)").first().find("i").parent().dispatch("click");
						await wait(10);
					}
					const input = await waitForNode('input[type="file"][accept*="image"]', false, form);
					const imgModify = { square: true }; // Use if needed

					const fileList = await Promise.all(
						dt.media.map(async (imgUrl) => {
							try {
								const response = await fetch(imgUrl);
								const blob = await response.blob();
								// Create a File object with the fetched blob
								return new File([blob], `image_${Date.now()}.${blob.type.split("/")[1]}`, { type: blob.type });
							} catch (error) {
								console.error("Error fetching image:", error);
								// Handle error (e.g., skip image or display message)
								return null;
							}
						})
					);

					const validFiles = fileList.filter((file) => file !== null);
					const dataTransfer = new DataTransfer();
					validFiles.forEach((file) => {
						dataTransfer.items.add(file);
					});
					input[0].files = dataTransfer.files;
					input.dispatch("change");
					await wait(2);
				}

				await setValue("title", dt.title);
				await setValue("price", parseFloat(dt.pricing.price));

				// Facebook Category Selection
				if (dt.facebook_category && dt.facebook_category.sub) {
					// Must have subcategory
					try {
						// 1. Find the main category dropdown button
						const categoryDropdownButton = await waitForNode('label[aria-label="Category"]', 5, form);

						console.log("19563", `${dt.facebook_category.sub}`, categoryDropdownButton);

						if (categoryDropdownButton && categoryDropdownButton.length > 0) {
							// 2. Click the button to open the dropdown
							categoryDropdownButton.dispatch("click");
							await wait(2000); // Wait for the dropdown to open

							// 3. Wait for the "Dropdown menu" div to appear
							const dropdownMenu = await waitForNode('div[role="dialog"][aria-label="Dropdown menu"]', 5);

							console.log("18743", dropdownMenu);

							if (dropdownMenu) {
								const subCategoryOption = await waitForNode(`span > div > span:contains("${dt.facebook_category.sub}")`, 5, dropdownMenu);
								if (subCategoryOption) {
									// 4. Click the subcategory option
									subCategoryOption.dispatch("click");
									console.log("subcategory found", subCategoryOption);
								} else {
									console.warn(`Subcategory "${dt.facebook_category.sub}" not found.`);
								}
							}

							// const subCategoryOption = await waitForNode(`div[role="button"]:has(>span:contains("${dt.facebook_category.sub}"))`, 5);
						} else {
							console.warn("Category dropdown button not found!");
						}
					} catch (error) {
						console.error("Error selecting Facebook category:", error);
					}
				}

				if (dt.description) {
					let desc = dt.description;
					if (dt.descriptionBottom && dt.descriptionBottom.facebook) desc += "\n\n" + dt.descriptionBottom.facebook;
					await setValue("description", convertHtmlToText(desc));
				}

				console.log("19522", dt.keywords);

				if (dt.keywords) {
					let moreDetailsDiv = await getInputDiv("More details");
					if (moreDetailsDiv) {
						moreDetailsDiv.dispatch("click");
						await wait(500);
					}
					console.log("keywords", dt.keywords);
					if (dt.keywords.length > 20) dt.keywords.splice(20);
					// let ta = await getInputDiv("Product");
					// let ta2 = await getInputDiv("Product tags");
					// console.log("tatata", ta, ta2);
					// if (!ta || !ta[0]) {
					// 	console.log("ta not found");
					// 	return;
					// }
					// ta = ta.find("textarea") || ta2.find("textarea");
					const ta = await waitForNode('label[aria-label="Product tags"] textarea', 1, form);
					if (!ta || !ta[0]) {
						console.log("ta not found");
						return;
					}
					ta.dispatch("focusin");
					ta.dispatch("click");
					await waitForNode("[role='button']", 1, ta.parent());
					// console.log("ta143", ta.parent());
					for (let key of dt.keywords) {
						ta.val(key).dispatch("input");
						await wait(10);
						ta.dispatch("keydown", { key: "Enter" });
						await waitForNode(`div[role="button"] > :first > span:contains(${key})`, 1, ta.parent().parent());
					}
					// Simulate Escape key press after adding all keywords
					const escapeKeyEvent = new KeyboardEvent("keydown", {
						bubbles: true,
						cancelable: true,
						key: "Escape",
						code: "Escape",
						keyCode: 27,
					});
					document.dispatchEvent(escapeKeyEvent);
				}
				if (dt.SKU) await setValue("SKU", dt.SKU);
			} else if (marketplace === "poshmark") {
				if (poshmarkAutofillInProgress) return;
				poshmarkAutofillInProgress = true;
				// *** Poshmark Logic ***
				const createListingHeader = await waitForNode('#content .card--large > h1:contains("Create Listing")', 5);
				if (!createListingHeader?.length) {
					console.error("Poshmark #content .card--large header not found!");
					return;
				}

				const cardLarge = await waitForNode("#content .card--large", 5);

				async function setPoshmarkValue(selector, value, parentNode = $("#content .card--large")) {
					const element = await waitForNode(selector, 5, parentNode);
					if (element && element.length && !element.val().trim) {
						element.val(value);
						element.dispatch("input");
						element.dispatch("change");
						element.dispatch("blur");
						await wait(1000);
						console.warn(`Poshmark element found: ${selector}`);
					} else {
						console.warn(`Poshmark element not found: ${selector}`);
					}
				}

				console.log("10722", dt);

				let imageList = [...dt.media];
				if (imageList.length > 0) {
					// 1. Wait for the main image upload field
					const imageInput = await waitForNode('input[type="file"][name="img-file-input"]', 5, cardLarge);

					if (imageInput && imageInput.length > 0) {
						let imgModify = { square: true };
						imageInput[0].files = await getDataTransfer(imageList, imgModify);
						imageInput.dispatch("change");

						// 2. Wait for the image edit modal to appear
						const imageForm = await waitForNode(".image-edit-modal", 5);

						if (imageForm) {
							// 3. Find the "Next" or "Done" button in the modal
							const nextButton = await waitForNode(".image-edit-modal .btn.btn--primary", 5);

							if (nextButton) {
								// ... (Wait for image previews to load if needed)

								nextButton.dispatch("click"); // Click "Next" or "Done"
							}
							await waitForNodeDisappear(imageForm);
						}
					} else {
						console.warn("Image upload input not found!");
					}
				}

				// Fill out Poshmark form fields
				await setPoshmarkValue('[placeholder="What are you selling? (required)"]', dt.title, cardLarge);
				await setPoshmarkValue('[placeholder="Describe it! (required)"]', convertHtmlToText(dt.description), cardLarge);

				// Poshmark Category Selection
				if (dt.poshmark_category?.main) {
					try {
						// 1. Find and open the main category dropdown
						const mainCategoryDropdown = await waitForNode(".listing-editor__category-container .dropdown__selector", 5, cardLarge);

						if (mainCategoryDropdown && mainCategoryDropdown.length > 0) {
							mainCategoryDropdown.dispatch("click"); // Simulate click to open
							await wait(2000); // Wait for dropdown to expand
							// 2. Find and click the main category option
							const mainCategoryOption = await waitForNode(`.dropdown__menu--expanded li a:has(>div:contains("${dt.poshmark_category.main}"))`, 5);

							if (mainCategoryOption && mainCategoryOption.length > 0) {
								mainCategoryOption.dispatch("click");
								await wait(1000); // Wait for subcategories to load

								// 3. Find and click the subcategory option
								if (dt.poshmark_category.sub) {
									const subCategoryOption = await waitForNode(`.dropdown__menu--expanded li div:contains("${dt.poshmark_category.sub}")`, 5);

									if (subCategoryOption && subCategoryOption.length > 0) {
										subCategoryOption.dispatch("click");
										await wait(1000); // Wait for sub-subcategories to load

										// 4. Find and click the sub-subcategory option (if available)
										if (dt.poshmark_category.subSub) {
											const subSubCategoryOption = await waitForNode(`.dropdown__menu--expanded li a:contains("${dt.poshmark_category.subSub}")`, 5);

											if (subSubCategoryOption && subSubCategoryOption.length > 0) {
												subSubCategoryOption.dispatch("click");
											} else {
												console.warn(`Sub-subcategory "${dt.poshmark_category.subSub}" not found.`);
											}
										}
									} else {
										console.warn(`Subcategory "${dt.poshmark_category.sub}" not found.`);
									}
								}
							} else {
								console.warn(`Main category "${dt.poshmark_category.main}" not found.`);
							}
						} else {
							console.warn("Poshmark category dropdown not found!");
						}
					} catch (error) {
						console.error("Error selecting Poshmark category:", error);
					}
				}

				await setPoshmarkValue('[placeholder="Enter the Brand/Designer"]', dt.brand, cardLarge);
				await setPoshmarkValue('[data-vv-name="listingPrice"]', dt.pricing.price, cardLarge);
				await setPoshmarkValue('[data-vv-name="sku"]', dt.SKU, cardLarge);
				await setPoshmarkValue('[data-vv-name="otherInfo"]', dt.side_notes, cardLarge);

				// Add tags
				if (dt.keywords && dt.keywords.length) {
					waitForNode(".listing-editor__tags__container", 5, cardLarge).then(async (div) => {
						await wait(200);
						div?.find("i").each(async (i, el) => {
							$(el).dispatch("click");
						});
						let input = await waitForNode("input", null, div);
						if (dt.keywords.length > 3) dt.keywords.splice(3);
						for (let tag of dt.keywords) {
							input.dispatch("click").val(tag).dispatch("keyup").dispatch("input");
							let lis = await waitForNode("ul.dropdown__menu--expanded li", 1);
							let found = false;
							if (lis) {
								let lTag = tag.toLowerCase();
								for (let li of lis) {
									if (li.innerText.toLowerCase() === lTag) {
										$(li).find(">div").dispatch("click");
										found = true;
										break;
									}
								}
							}
							if (!found) input.dispatch("keyup", { keyCode: 13 });
						}
						const styleTagsDiv = await waitForNode('.listing-editor__section__title:contains("Style Tags")');
						if (styleTagsDiv.length) {
							styleTagsDiv.dispatch("click");
						} else {
							console.warn('Poshmark "Style Tags" div not found.');
						}
					});
				}
			}
		} catch (error) {
			console.error("Error in autofillForm:", error);
		} finally {
			console.log("autofillForm 1646", autofillInProgress);
			// autofillInProgress = false;
		}
	}

	// CSS for checkboxes

	const checkboxCSS = `
    .listing-checkbox-container {
      display: flex;
      align-items: center;
      margin-bottom: 25px;
	  gap: 12px;
    }

    .listing-checkbox {
      appearance: none;
      width: 22px;
      height: 22px;
      border: 2px solid gray;
      border-radius: 3px;
      cursor: pointer;
    }

    .listing-checkbox:checked {
      background-color: #0fb81e;
    }

    .listing-checkbox:checked::before {
      content: "✓";
      display: block;
      color: white;
      text-align: center;
	  align-self: center;
    }

	.done-selecting-button {
		background-color: #0fb81e; /* Use your brand's primary color */
		color: white;
		padding: 10px 20px;
		border: none;
		border-radius: 5px;
		font-weight: bold;
		cursor: pointer;
		margin-bottom: 10px; /* Add spacing below the button */
		display: block; /* Make the button take up the full width */
		text-align: center;
		}

	.done-selecting-button:hover {
		opacity: 0.8;
	}

	.selection-instructions { /* Style for the instructions */
		margin-bottom: 10px;
		font-weight: bold;
		}

	.tile .listing-checkbox:checked + label {
		background-color: lightyellow; /* Highlight selected listings */
		}
  `;

	// Function to inject CSS
	function injectCSS(css) {
		const style = document.createElement("style");
		style.textContent = css;
		document.head.appendChild(style);
	}

	// To add checkboxes for listings on closet page

	let selectedPoshmarkListings = []; // Array to store selected listing URLs

	const MAX_LISTING_SELECTIONS = 20;

	// Function to create and display the notification
	function showSelectionLimitNotification() {
		// Create a div for the notification
		const notificationDiv = $("<div>");
		notificationDiv.text(`You can select a maximum of ${MAX_LISTING_SELECTIONS} listings.`);
		notificationDiv.addClass("listing-selection-limit-notification");

		// Add CSS to style the notification (you can customize this)
		notificationDiv.css({
			position: "fixed",
			top: "20px", // Adjust position as needed
			left: "50%",
			transform: "translateX(-50%)",
			backgroundColor: "#e44646", // Match your website's failure toast
			color: "white",
			padding: "10px 20px",
			borderRadius: "5px",
			zIndex: "10000", // Ensure it's on top
		});

		// Append to the body
		$("body").append(notificationDiv);

		// Optionally, add a timeout to automatically hide the notification
		setTimeout(() => {
			notificationDiv.fadeOut("slow", () => {
				notificationDiv.remove();
			});
		}, 3000); // 3 seconds
	}

	// Function to handle checkbox changes
	function handleCheckboxChange() {
		const checkedCount = $(".listing-checkbox:checked").length;

		if (checkedCount > MAX_LISTING_SELECTIONS) {
			showSelectionLimitNotification();
			$(this).prop("checked", false); // Uncheck the box
			return; // Stop execution
		}
	}

	// Function to add checkboxes and "Done Selecting" button
	async function addPoshmarkListingSelectionUI(handleDoneSelectingAndImportToCognition) {
		console.log("18743", poshmarkUIAdded);
		if (poshmarkUIAdded) {
			return;
		}
		injectCSS(checkboxCSS);
		const listingTiles = await waitForNode(".tiles_container .tile", 25);

		if (listingTiles && listingTiles.length > 0) {
			listingTiles.each((index, tile) => {
				const listingURL = $(tile).find("a.tile__covershot").attr("href");

				// Create checkbox element
				const checkbox = $('<input type="checkbox" />');
				checkbox.attr("id", `listing-${index}`);
				checkbox.addClass("listing-checkbox");

				// Add change event listener to the checkbox
				checkbox.on("change", handleCheckboxChange);

				// Create label for the checkbox
				const label = $("<label />");
				label.attr("for", `listing-${index}`);
				label.text("Select"); // You can style this label as needed

				// Wrap checkbox and label in a div for styling
				const checkboxContainer = $('<div class="listing-checkbox-container"></div>');

				// Append children to the container *before* adding it to the DOM
				checkboxContainer.append(checkbox);
				checkboxContainer.append(label);

				// Prepend checkbox to the tile
				$(tile).prepend(checkboxContainer);
			});

			// Create "Done Selecting" button
			const doneButton = $("<button>Import to Cognition</button>");
			doneButton.addClass("done-selecting-button");
			doneButton.click(handleDoneSelectingAndImportToCognition);

			const instructions = $(
				'<div class="selection-instructions">Select the listings you want to import, then click "Import to Cognition".</div>'
			);
			instructions.css({
				marginBottom: "10px",
				fontWeight: "bold",
			});
			$(".tiles_container").before(instructions); // Add above the listings
			$(".tiles_container").before(doneButton); // Add the button below
			poshmarkUIAdded = true;
		} else {
			console.warn("Poshmark listing tiles not found.");
		}
	}

	// Function to extract data from a single listing page of poshmark
	async function getPoshmarkListingData(listingURL) {
		console.log("listingURL 1652", listingURL);
		const pageHTML = await getHttpResponse(listingURL);

		console.log("pageHTML 1656", pageHTML);
		const $page = $(pageHTML); // Create a jQuery object for easier DOM manipulation

		// Extract data using jQuery selectors
		const images = $page
			.find(".carousel__item picture img")
			.map((index, img) => $(img).attr("src"))
			.get();
		const title = $page.find(".listing__title h1").text().trim();
		const brand = $page.find(".listing__brand.listing__ipad-centered").text().trim();
		const price = $page.find(".listing__ipad-centered .h1").text().trim();
		const description = $page.find(".listing__description").text().trim();
		const category = $page
			.find(".tag-details__btn a")
			.map((index, a) => $(a).text().trim())
			.get()
			.join(" > ");
		const styleTags = $page
			.find('[data-et-name="style_tag"] a')
			.map((index, a) => $(a).text().trim())
			.get();

		const listing = {
			url: listingURL,
			images,
			title,
			brand,
			price,
			category,
			styleTags,
			description,
			// ... extract other fields ...
		};

		return listing;
	}

	// Listen for messages from the background script
	chrome.runtime.onConnect.addListener((port) => {
		console.log("Connected to background script8755", port.sender.id);

		port.onMessage.addListener(async (request) => {
			console.log("Message received from background");
			if (request.action === "fillListingData") {
				const { marketplace, data, tab } = request;

				console.log("18244", tab);

				autofillForm(data, marketplace).then(() => {
					console.log("Sending response to background: Data processed");
					port.postMessage({ status: "Data received and processed" });
					return;
				});
				// await autofillForm(data, marketplace);
				port.postMessage({ status: "Data received and processed" });
			}

			if (request.action === "poshmarkFeedPageReady") {
				// Get the closet URL
				const imgElement = await waitForNode(".header__account-info__link .dropdown__selector img", 25); // Wait for image
				console.log("poshmarkFeedPageReady", imgElement);
				if (imgElement && imgElement.length) {
					const username = imgElement.attr("alt"); // Extract username from img alt
					console.log("username143", username);
					const closetURL = `https://poshmark.com/closet/${username}`;
					console.log("Closet URL:", closetURL);

					// Send URL to background script
					// chrome.runtime.sendMessage({ action: "poshmarkClosetURL", url: closetURL });
					port.postMessage({ action: "poshmarkClosetURL", url: closetURL });
				} else {
					port.postMessage({ action: "poshmarkClosetURL", url: null });
					console.error("Could not find Poshmark username or image element.");
				}
			}

			if (request.action === "enterPoshmarkListingSelectionMode") {
				// Function to handle "Done Selecting" button click
				async function handleDoneSelectingAndImportToCognition() {
					selectedPoshmarkListings = $(".listing-checkbox:checked")
						.map((index, checkbox) => {
							const tile = $(checkbox).closest(".tile");
							return tile.find("a.tile__covershot").attr("href");
						})
						.get();

					console.log("Selected Poshmark Listings:", selectedPoshmarkListings);

					let selectedListingsData = [];

					for (const listingURL of selectedPoshmarkListings) {
						const data = await getPoshmarkListingData(`https://poshmark.com${listingURL}`);
						selectedListingsData.push(data);
					}

					console.log("19623", selectedListingsData);

					// Send selected listings to the background script
					port.postMessage({
						action: "poshmarkListingsSelectedData",
						listings: selectedListingsData,
					});
				}
				// Call the function to add checkboxes and button
				await addPoshmarkListingSelectionUI(handleDoneSelectingAndImportToCognition);

				// Send message to background script
				port.postMessage({ action: "poshmarkListingSelectionUIAdded" });
			}

			if (request.action === "extractPoshmarkListings") {
				console.log("Extracting listings...");
				// ... Add your code here to extract listings from the closet page ...
				// When you're done extracting, you can send a message back to the
				// background script to indicate success or failure.

				// Example (replace with your actual extraction and message passing logic)
				try {
					console.log("Extracting listings...");

					const listingData = [];

					// Wait for the listing tiles to load
					const listingTiles = await waitForNode(".tiles_container .tile", 25);
					console.log("Number of listings found:", listingTiles.length);

					for (let i = 0; i < listingTiles.length; i++) {
						const tile = listingTiles.eq(i);
						const listingURL = tile.find("a.tile__covershot").attr("href");
						console.log("Listing URL:", listingURL);

						// Open each listing in a new tab (optional, but can be helpful for debugging)
						// const newTab = await createTabReady(listingURL, false);

						// Fetch listing data
						const data = await getPoshmarkListingData(`https://poshmark.com${listingURL}`);
						listingData.push(data);
					}

					port.postMessage({ action: "listingsExtracted", status: "success", listingData: listingData });

					console.log("Extension: Message sent to website194", window);
					// ... extract listings from the page ...
					// port.postMessage({ action: "listingsExtracted", status: "success", listings: { rrge: gerg } });
				} catch (error) {
					port.postMessage({ action: "listingsExtracted", status: "error", error: error.message });
				}
			}

			if (request.action === "extractFacebookListings") {
				// 1. Wait for the individual ACTIVE listing divs to load

				console.log("Extracting listings...", "4550");
				if (extractFacebookListingsInProgress) {
					return;
				}

				try {
					extractFacebookListingsInProgress = true;
					const listingsAll = await waitForNode(
						".x9f619.x1n2onr6.x1ja2u2z.x78zum5.xdt5ytf.x2lah0s.x193iq5w.x1k70j0n.xzueoph.xzboxd6.x14l7nz5",
						10
					);
					// const listings = await waitForNode(
					// 	".x9f619.x1n2onr6.x1ja2u2z.x78zum5.xdt5ytf.x2lah0s.x193iq5w.x1k70j0n.xzueoph.xzboxd6.x14l7nz5 > div > div > div.tile",
					// 	10
					// );
					console.log("4551", listingsAll);

					let listingLinks = [];

					if (listingsAll && listingsAll.length) {
						// 2. Filter listings to get only ACTIVE listings
						const listings = listingsAll.filter((index, listing) => {
							// Check if the listing contains the "Active" text
							return $(listing).text().includes("Active");
						});

						console.log("Listing 455245", listings);
						// 2. Iterate through each listing div
						for (let i = 0; i < listings.length; i++) {
							const listing = listings.eq(i);

							console.log("Listing 4552", i, listing);

							// 1. Modify the selector to match the aria-label conditions. Wait for the "More" button
							const moreButtonSelector = 'div[aria-label="More"], div[aria-label*="More options for"]';
							const moreButton = await waitForNode(moreButtonSelector, 5, listing);

							console.log("Listing 4553", i, moreButton);

							if (moreButton && moreButton.length) {
								// 2. Click the "More" button
								// moreButton[0].dispatch("click");

								console.log("Listing 4554", i, moreButton);

								// 2. Select the first "More" button
								const firstMoreButton = moreButton.first();

								console.log("Listing 45542", i, firstMoreButton);

								// 3. Click the first "More" button
								firstMoreButton.dispatch("click");

								console.log("3554", firstMoreButton);

								const menu = await waitForNode('div[role="menu"]', 15);

								// 3. Wait for the "View Listing" link to appear
								const viewListingLink = await waitForNode('a[role="menuitem"]:contains("View listing")', 15, menu);

								console.log("Listing 4555", i, viewListingLink);

								if (viewListingLink && viewListingLink.length) {
									// 4. Extract the href attribute
									const listingURL = viewListingLink.attr("href");
									listingLinks.push(listingURL);
									// await getPoshmarkListingData("https://www.facebook.com/marketplace/item/439829408901317");
									// console.log(`"View Listing" link found in listing ${i}: ${listingURL}`);
									// // 5. Simulate pressing the Escape key
									const escapeKeyEvent = new KeyboardEvent("keydown", {
										bubbles: true,
										cancelable: true,
										key: "Escape",
										code: "Escape",
										keyCode: 27,
									});
									document.dispatchEvent(escapeKeyEvent);
									console.log("Escape key pressed.");
								} else {
									console.warn(`"View Listing" link not found in listing ${i}`);
								}
							} else {
								console.warn(`"More" button not found in listing ${i}`);
							}
						}

						console.log("listingLinks143", listingLinks);
					}

					const baseURL = "https://www.facebook.com";

					const absoluteLinks = listingLinks.map((link) => `${baseURL}${link}`);
					console.log("absoluteLinks143", absoluteLinks);
					port.postMessage({ action: "facebookListingLinksExtracted", status: "success", listingLinks: absoluteLinks });
				} catch (error) {
					port.postMessage({ action: "facebooklistingsNotExtracted", status: "error", error: error.message });
					extractFacebookListingsInProgress = false;
				} finally {
					extractFacebookListingsInProgress = false;
				}

				// const allListingsHeader = await waitForNode('h2:contains("All listings")', 10);
			}

			if (request.action === "extractFacebookListingData") {
				// Start extracting the listing data from the current page
				console.log("Extracting Facebook listing data from page...");

				try {
					// 1. Wait for the listing details div to appear
					const listingDetailsDiv = await waitForNode(".x78zum5.xdt5ytf.x1iyjqo2.x1n2onr6", 10);

					if (listingDetailsDiv.length) {
						console.log("Listing details div found.", listingDetailsDiv);

						// 2. Extract listing details
						const title = listingDetailsDiv.find("h1 > span").text().trim();
						const price = listingDetailsDiv.find('span:contains("₹")').first().text().trim();
						const condition = listingDetailsDiv.find('span:contains("Condition")').next().text().trim();
						const color = listingDetailsDiv.find('span:contains("Colour")').next().text().trim();
						const brand = listingDetailsDiv.find('span:contains("Brand")').next().text().trim();
						const description = listingDetailsDiv.find('div[justify="all"] > span').last().text().trim();

						// 3. Wait for the image carousel to load
						const imageCarousel = await waitForNode(".x1a0syf3.x1ja2u2z", 5);
						let imageURLs = [];

						if (imageCarousel.length) {
							console.log("Image carousel found.");

							const imageThumbnails = await waitForNode('div[aria-label^="Thumbnail"]', 5, imageCarousel);

							// 4. Find all image thumbnails
							// const imageThumbnails = imageCarousel.find('[aria-label^="Thumbnail"]');

							console.log("imageThumbnails", imageCarousel, imageThumbnails);

							// 5. Click each thumbnail and extract full-size image URL
							for (let j = 0; j < imageThumbnails.length; j++) {
								const thumbnail = imageThumbnails.eq(j);
								thumbnail.dispatch("click");

								// 6. Wait for the full-size image to load (adjust selector if needed)
								const fullSizeImage = await waitForNode(".xz74otr", 5);

								if (fullSizeImage.length) {
									const imageURL = fullSizeImage.attr("src");
									imageURLs.push(imageURL);
									console.log("Extracted image URL:", imageURL);
								} else {
									console.warn("Could not find full-size image.");
								}
							}
						}

						// Create listing data object
						const listingData = {
							title,
							price,
							condition,
							color,
							description,
							brand,
							images: imageURLs,
							// ... extract other fields as needed ...
						};
						console.log("listingData14309", listingData);

						// 3. Send extracted data back to the background script
						port.postMessage({
							action: `facebookListingDataExtractedFor${request.url}`,
							listingData: listingData,
						});
					} else {
						console.warn("Listing details div not found.");
						// ... Handle error - you might want to send a message to the
						// background script indicating failure.
					}
				} catch (error) {
					console.error("Error extracting Facebook listing data:", error);
					// ... Handle error - send error message to the background script
				}
			}

			if (request.action === "checkMarketplaceConnectionAndClose") {
				checkMarketPlaceLoginStatus(request.marketplace).then(() => {
					console.log("Sending response to background: Data processed");
					port.postMessage({ status: "Data received and processed" });
				});
			}
		});
	});

	// 1. Listen for messages from the background script
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		console.log("032", request);

		if (request.action === "poshmarkListingsReady") {
			// 2. Forward the data to your website's JavaScript using window.postMessage
			window.postMessage(
				{
					type: "FROM_EXTENSION_POSHMARK_LISTINGS", // Choose a unique type
					listings: request?.listings,
				},
				"*"
			);
			console.log("Listing data forwarded to website's main JavaScript.");
		}

		if (request.action === "facebookListingsReady") {
			console.log("032", request);

			// 2. Forward the data to your website's JavaScript using window.postMessage
			window.postMessage(
				{
					type: "FROM_EXTENSION_FACEBOOK_LISTINGS", // Choose a unique type
					listings: request?.listings,
				},
				"*"
			);
			console.log("Listing data forwarded to website's main JavaScript.");
		}

		if (request.action === "checkPoshmarkConnection") {
			console.log("7566");
			// checkPoshmarkLoginStatusAndClose();
			checkMarketPlaceLoginStatus("poshmark");
		}

		if (request.action === "checkFacebookConnection") {
			console.log("7566");
			// checkFacebookLoginStatusAndClose();
			checkMarketPlaceLoginStatus("facebook");
		}

		if (request.action === "marketPlaceLoginStatus") {
			console.log("7566", request);
			window.postMessage(
				{
					type: "FROM_EXTENSION_MARKETPLACE_LOGIN_STATUS", // Choose a unique type
					data: request,
				},
				"*"
			);
		}
	});
});
