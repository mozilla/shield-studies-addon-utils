document.addEventListener("click", async e => {
  if (e.target.id === "onEveryExtensionLoad-button") {
    browser.runtime
      .sendMessage("test:onEveryExtensionLoad")
      .catch(console.error);
  }
});
