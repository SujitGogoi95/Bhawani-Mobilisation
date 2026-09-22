# Google Apps Script Setup & Deployment Guide

This guide explains how to connect your **Google Sheets** and **Google Drive** folder (`1isPW6zFeK3-c1DNe3ADxfoN9ZNiTdfRp`) to your Bhawani Mobilisation Management System (MMS).

---

## Google Drive Configuration Details
* **Parent Folder ID**: `1isPW6zFeK3-c1DNe3ADxfoN9ZNiTdfRp`
* **Access Policy**: **Restricted** (Private to your Google account/workspace). Documents are **never** made public or given `ANYONE_WITH_LINK` permissions.
* **Organization**: Each candidate gets a subfolder named `[Candidate ID] - [Candidate Name]` inside the parent folder to keep documents tidy and secure.

---

## Step 1: Open Google Apps Script Editor
1. Open your linked Google Sheet (e.g. Bhawani Mobilisation Database).
2. In the top menu, click **Extensions** > **Apps Script**.
3. In the script editor:
   - Select the file `Code.gs`.
   - Clear any existing contents and replace with the code provided in `google-apps-script/Code.gs`.
   - Click **Save** (disk icon or `Ctrl+S` / `Cmd+S`).

---

## Step 2: Authorize Google Drive & Sheets Access
Because the script now interacts with **Google Drive** (`DriveApp`) to store uploaded candidate documents, Google requires authorization:
1. In the Apps Script editor, look at the toolbar dropdown next to the **Debug** button.
2. Select the function `doGet`.
3. Click **Run** (the triangle button ▶).
4. An **"Authorization required"** dialog will pop up:
   - Click **Review Permissions**.
   - Select your Google account.
   - If you see **"Google hasn't verified this app"**, click **Advanced** (bottom left of the modal), then click **Go to [Project Name] (unsafe)**.
   - Click **Allow** to grant access to Google Sheets and Google Drive.
5. In the Execution log at the bottom, you should see `Execution completed`.

---

## Step 3: Redeploy the Web App (Crucial Step!)
Whenever you add or change code in Google Apps Script, you **must create a new version** for the Web App URL to run the new code:

1. In the top-right corner of the Apps Script editor, click **Deploy** > **Manage deployments**.
2. In the modal, select your active deployment with the Web App URL.
3. Click the **Edit** (pencil icon) in the top right of the modal.
4. In the **Version** dropdown, click **New version**.
   - Optional description: `Added uploadDocument and Google Drive integration`
5. Verify the deployment settings:
   - **Execute as**: `Me (your_email@gmail.com)`
   - **Who has access**: `Anyone` *(Note: This allows the web app to call the script; the Drive files themselves remain strictly restricted and private to your account).*
6. Click **Deploy**.
7. Copy the **Web app URL** if it is different, and confirm it matches your endpoint.

---

## Step 4: Test in the Candidate Registration Form
1. Open the Candidate Registration form in the app.
2. Complete Steps 1 to 4 (Basic Details, Address, Education, Project & Mobiliser).
3. On **Step 5 (Document Collection)**:
   - Check the documents you have collected.
   - Click **Attach PDF / Scan** next to any document (e.g. Aadhar Card or On-field Registration Form).
   - Select your PDF or photo (≤ 15MB).
4. Click **Register & Save Student**.
5. The app will upload the file directly to your Google Drive folder `1isPW6zFeK3-c1DNe3ADxfoN9ZNiTdfRp` and record the candidate and file links in your Google Sheet!
