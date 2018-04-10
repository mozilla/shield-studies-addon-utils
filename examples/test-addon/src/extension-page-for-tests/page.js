/* global browser */

document.addEventListener("click", async e => {
  function handleError(error) {
    console.error(error);
  }
  function noop() {}
  if (e.target.id === "initiateStudy-button") {
    await browser.runtime
      .sendMessage("test:initiateStudy")
      .then(noop, handleError);
  }
});
