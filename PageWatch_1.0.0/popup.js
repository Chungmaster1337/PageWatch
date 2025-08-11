const urlBox = document.getElementById("urlList");
const saveBtn = document.getElementById("saveBtn");
const runNowBtn = document.getElementById("runNowBtn");

chrome.storage.local.get(["monitoredUrls"], (result) => {
  const urls = result.monitoredUrls || [];
  urlBox.value = urls.join("\n");
});

saveBtn.onclick = () => {
  const urls = urlBox.value.split("\n").map(u => u.trim()).filter(u => u);
  chrome.storage.local.set({ monitoredUrls: urls });
};

runNowBtn.onclick = () => {
  chrome.runtime.sendMessage({ type: "runNow" });
};
