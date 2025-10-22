Deployment steps for Firestore indexes

1) Ensure you have the Firebase CLI installed and you're logged in:

   npm install -g firebase-tools
   firebase login


2) From the `frontend` folder (where this README and `firestore.indexes.json` live), run:

   # login if needed
   firebase login

   # update the indexes (shows output unless you pass --quiet)
   firebase firestore:indexes:update --project <YOUR_PROJECT_ID> --file .\firestore.indexes.json

   # or deploy only the indexes (if firebase.json is configured)
   firebase deploy --only firestore:indexes --project <YOUR_PROJECT_ID>

3) Verify index creation in Firebase Console -> Firestore -> Indexes, or run `firebase firestore:indexes:list --project <YOUR_PROJECT_ID>`.

Notes:
- The file `firestore.indexes.json` contains composite indexes required for queries that combine `where('userId', '==', uid)` with `orderBy('createdAt', 'desc')` and `where('status','==',...)` + `orderBy('createdAt', 'desc')`.
- Index creation can take a few minutes to complete. If Firestore previously returned an error with an index URL, opening that URL in the browser also walks you through creating the index.
