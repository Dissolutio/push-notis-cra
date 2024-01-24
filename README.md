# push-notis-cra
## Run the project:
 If you run node index.js in the root, and npm start in the frontend, you'll see the request for notifications in the browser, the subscription in the console of the server, and the notification back in the browser!

## The article:
Article from https://medium.com/@seladir/how-to-implement-web-push-notifications-in-your-node-react-app-9bed79b53f34:

The purpose of this article is to provide some boilerplate for web push notifications using common technologies: Node.js & Express on the backend and React.js (Create React App) on the frontend.

First, let’s describe a generalized life cycle of web push notifications:

1. A client app installs a service worker. It is an autonomously working script in your browser which takes more and more functions in recent years. So even if the tab with the application is not currently open, the service worker will accept and show a notification.
2. A user receives a request to display notifications.
3. After receiving permission to display notifications, the browser hands credentials and other service information to the app. This data must be sent to the backend and stored in the db.
4. Using the previously received credentials, the backend makes a request to the service provider, which in turn sends a notification to the service worker.
5. The service worker receives a notification and shows it.

## Step 1: Starting the Node.js application and getting VAPID keys.
We initialize our backend application with all necessary dependencies with the command:
`yarn add express dotenv body-parser cors web-push`

In order to secure a notifications transmission channel from outside interference, so-called VAPID keys are used. The public key is sent to a push service at the time of subscription. In future your backend app will use these keys as an authentication measure while sending a notification through the push service. You can generate VAPID keys using the command:
`./node_modules/.bin/web-push generate-vapid-keys`
Now that we have a couple of keys, we will jump to creation of a client application and go through the whole scenario: from a subscription to sending a notification.

## Step 2: Creating a React app and a worker service.
As a frontend we will use a React application, namely, it will be CRA. This is quite a popular way to create single-page applications, so as an illustration, I preferred it to vanilla JS. On the other hand, the CRA has some pitfalls in terms of using a service worker, which will be discussed below.

So, we initialize our application in the new web-push-front folder with the command:
`yarn create react-app web-push-front`
You can check app working by running the command `yarn start` and visiting http://localhost:3000/

By default, CRA works in such a way that the service worker is absent in the dev mode and any previously installed service worker is replaced by a dummy.
To begin with, replace in `src/index.js` the line 
`serviceWorker.unregister();` 
with this line:
 `serviceWorker.register();`

Next, we modify the `register()` function in the `src/serviceWorker.js` file removing the condition:
`process.env.NODE_ENV === 'production'`
so that the service worker is loaded not only in prod mode.

By default, a dummy file generated on-the-fly is given to the dev-mode at http://localhost:3000/service-worker.js. To get around this change the name of the file that is given in dev-mode to `custom-sw.js`

```js
const swFileName = process.env.NODE_ENV === 'production'
 ? 'service-worker.js'
 : 'custom-sw.js'
const swUrl = `${process.env.PUBLIC_URL}/${swFileName}`
```

Now let’s create a service worker in the public folder which will listen to the push event and display notifications.
****
```js
self.addEventListener('push', event => {
  const data = event.data.json();
  console.log('New notification', data);
  const options = {
    body: data.body,
  }
  event.waitUntil(
   self.registration.showNotification(data.title, options)
  );
```

Now open DevTools with the Update on reload option enabled or its equivalent in your favorite browser and reload the page. As the result, custom-sw.js should be installed.

You can check its working by sending a test local notification with such content:
`{“body”: “devbody”, “title”: “devtest”}`

IMAGE HERE

## Step 3: Subscribe to notifications.
First, we create a .env file, in which we fill in the URL of our backend and the previously generated public VAPID key.

```js
REACT_APP_API_URL=http://localhost:9000
REACT_APP_PUBLIC_VAPID_KEY={previously generated public VAPID key}
```

Now implement the entire script for subscribing to notifications in the `src/subscription.js` file:

```js
const convertedVapidKey = urlBase64ToUint8Array(process.env.REACT_APP_PUBLIC_VAPID_KEY)

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4)
  // eslint-disable-next-line
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/")

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function sendSubscription(subscription) {
  return fetch(`${process.env.REACT_APP_API_URL}/notifications/subscribe`, {
    method: 'POST',
    body: JSON.stringify(subscription),
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export function subscribeUser() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(function(registration) {
      if (!registration.pushManager) {
        console.log('Push manager unavailable.')
        return
      }

      registration.pushManager.getSubscription().then(function(existedSubscription) {
        if (existedSubscription === null) {
          console.log('No subscription detected, make a request.')
          registration.pushManager.subscribe({
            applicationServerKey: convertedVapidKey,
            userVisibleOnly: true,
          }).then(function(newSubscription) {
            console.log('New subscription added.')
            sendSubscription(newSubscription)
          }).catch(function(e) {
            if (Notification.permission !== 'granted') {
              console.log('Permission was not granted.')
            } else {
              console.error('An error ocurred during the subscription process.', e)
            }
          })
        } else {
          console.log('Existed subscription detected.')
          sendSubscription(existedSubscription)
        }
      })
    })
      .catch(function(e) {
        console.error('An error ocurred during Service Worker registration.', e)
      })
  }
}
```

Let’s analyze it in detail. The main function `subscribeUser()` is designed to handle the maximum possible situations: lack of support for push notifications by a browser, prohibiting displaying notifications by a user, etc. The subscription itself is created by calling `registration.pushManager.subscribe()` where we pass our public VAPID key. Before it needs to be converted, so we will use the implementation of the function `urlBase64ToUint8Array()` from the Google tutorial. In the case of a successful subscription or if there is an existing subscription, we receive credentials. Each browser implements the delivery of push-notifications through its service. Using Google Chrome as an example, the resulting credentials will look like:

```js
{
  endpoint: 'https://fcm.googleapis.com/fcm/send/chhjHsBv3DU:APA91bGJCZnXCfkGeAa2nlo5n3fkP4aNw1J7Y34s9neghg0KowAKJcUqIbm97TuuASOD8VD4CpWNpVrKaX3E1f-rwLaINlKOCwGUFCUtZG9qpYNBT3edlEF0mznLK3gJN3rp7XwJAc2y',
  expirationTime: null,
  keys: {
    p256dh: 'BBe1YEEq3YuUwYxekAYug5xdjTg18IUkvdTLjRjshN4lnbytK-b7_3iAbYEpgjsFRvboIPsc3h_3wWM8TCRisSc',
    auth: 'uQq5Eyjzvwv66ddqwXa1PA'
  }
}
```

After, send this object to the backend with a typical POST request with calling `sendSubscription()`.
Finally, import the function `subscribeUser()` from `subscription.js` to `index.js` and add its call at the very end of the file.

## Step 4: Getting credentials on the backend side and sending a notification.
It is time to breathe life into the Node-application template.
To begin with, we create an `.env` file, in which we specify a pair of VAPID-keys as well as your contact address as the sender of notifications.

```js
// Push notifications keys. You can generate them with command "./node_modules/.bin/web-push generate-vapid-keys"
PUBLIC_VAPID_KEY=
PRIVATE_VAPID_KEY=

// This must be either a URL or a 'mailto:' address.
// For example: 'https://my-site.com/contact' or 'mailto: contact@my-site.com'
WEB_PUSH_CONTACT="mailto: contact@my-site.com"
```

Next, for simplicity let’s implement all the logic of the backend app in a single index.js file.

```js

const express = require('express')
const dotenv = require('dotenv')
const bodyParser = require('body-parser')
const cors = require('cors')
const webpush = require('web-push')

const app = express()

dotenv.config()

app.use(cors())
app.use(bodyParser.json())

webpush.setVapidDetails(process.env.WEB_PUSH_CONTACT, process.env.PUBLIC_VAPID_KEY, process.env.PRIVATE_VAPID_KEY)

app.get('/', (req, res) => {
  res.send('Hello world!')
})

app.post('/notifications/subscribe', (req, res) => {
  const subscription = req.body

  console.log(subscription)

  const payload = JSON.stringify({
    title: 'Hello!',
    body: 'It works.',
  })

  webpush.sendNotification(subscription, payload)
    .then(result => console.log(result))
    .catch(e => console.log(e.stack))

  res.status(200).json({'success': true})
});

app.listen(9000, () => console.log('The server has been started on the port 9000'))
```

Things that happen there:

1. Initialize the Express framework.
2. Use env-config.
3. Disable the security policy CORS. Be careful and consciously tune this in production.
4. Apply body-parser.
5. The web push module is initialized with VAPID keys and a contact address.
6. A test GET endpoint to see that the server works.
7. An endpoint accepting a request with credentials. In a real app they must be saved in a database. In our example we use them to immediately send a notification.

So, we start the server with the `node index.js` command and go to http://localhost:9000 to make sure it works.
Now both applications are ready and you can open the client part again and see a popup asking for permission to notify. If you agree, you can see how a request with credentials is sent to the backend and after a push notification arrives. Congratulations!

## Extra step: Wait, what about the production mode?

In this case Create React App compiles files in the `build` folder and a default service worker which is placed there contains useful for modern apps things. If we decide to keep them and just add our push-functionality, some modding of the build process is needed. There is Workbox used for service worker building in CRA. And there is no a built-in way to modify it even if your purpose is just to add some custom code. I consider this package as the most convenient way to do it if you are not ready to actively immerse yourself in research of Workbox configuring in context of CRA.

At first, add a new dependency:
`npm install cra-append-sw`
After, we need to extend the build-script in `package.json` adding there a new command which is executed after the main process so that the full line will look like:
`react-scripts build && cra-append-sw --skip-compile ./public/custom-sw.js`

As the result, content of `custom-sw.js` will be appended at the very end of the `build/service-worker.js` file.

And finally, general advice on the strategy for displaying a subscription request. If a user rejects such a request, you will not have a second chance to offer a subscription until the user cancels prohibition in the browser settings (and they are unlikely to want to do this). So use this chance wisely selecting the right moment: this is definitely not the case when the user gets to your site for the first time. If you want to be able to annoy a user many times, first show a custom dialogue with the offer to subscribe. And only if a user agrees, show the real one.

If something goes wrong, you can check with the boilerplate:
Node app: https://github.com/seladir/demo-webpush-node
React app: https://github.com/seladir/demo-webpush-react


