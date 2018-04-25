document.addEventListener("click", async e => {
  if (e.target.id === "onEveryExtensionLoad-button") {
    const response = await browser.runtime
      .sendMessage("test:onEveryExtensionLoad")
      .catch(console.error);
    console.log("onEveryExtensionLoad response", response);
  }
});
