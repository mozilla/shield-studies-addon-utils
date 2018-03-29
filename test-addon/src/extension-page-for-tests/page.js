document.addEventListener("click", async e => {
  function handleError(error) {
    console.error(error);
  }

  if (e.target.id === "initiateStudy-button") {
    await browser.runtime.sendMessage("test:initiateStudy");
  }
});
