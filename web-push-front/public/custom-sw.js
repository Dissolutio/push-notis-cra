self.addEventListener("push", (event) => {
  const data = { body: "default body" };
  try {
    const data = event?.data?.json();
  } catch (error) {
    console.log("🚀 ~ self.addEventListener ~ error:", error);
  }
  console.log("New notification", data);
  const options = {
    body: data?.body,
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});
