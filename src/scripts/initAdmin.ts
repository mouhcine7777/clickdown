// scripts/initAdmin.ts
// Run this script ONCE to create the initial admin user
// Usage: npx tsx scripts/initAdmin.ts

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import * as readline from 'readline';

// Replace with your Firebase config
const firebaseConfig = {
  // Your Firebase config here
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function createAdmin() {
  console.log('\n🔐 ADMIN ACCOUNT CREATION');
  console.log('=' .repeat(50));
  console.log('This script will create the first admin account for your system.');
  console.log('⚠️  WARNING: Run this script only ONCE!\n');

  try {
    // Get admin details
    const name = await question('Enter admin name: ');
    const email = await question('Enter admin email: ');
    const password = await question('Enter admin password (min 6 chars): ');
    
    if (password.length < 6) {
      console.error('❌ Password must be at least 6 characters!');
      process.exit(1);
    }

    console.log('\n📝 Creating admin account...');

    // Create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;

    // Check if user already exists
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      console.log('⚠️  User already exists. Updating role to admin...');
    }

    // Create/Update user document with admin role
    await setDoc(doc(db, 'users', userId), {
      name: name,
      email: email,
      role: 'admin', // Set as admin
      createdAt: serverTimestamp(),
      isInitialAdmin: true, // Mark as the initial admin
    });

    console.log('\n✅ SUCCESS! Admin account created.');
    console.log('=' .repeat(50));
    console.log('Admin Details:');
    console.log(`  Name: ${name}`);
    console.log(`  Email: ${email}`);
    console.log(`  User ID: ${userId}`);
    console.log(`  Role: ADMIN`);
    console.log('\n🚀 You can now login with these credentials.');
    console.log('💡 TIP: Admins can promote other users to manager role from the Users page.\n');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('\n💡 If this user should be an admin, you can manually update their role in Firebase Console:');
      console.log('   1. Go to Firestore Database');
      console.log('   2. Find the users collection');
      console.log('   3. Find the user document by email');
      console.log('   4. Change role field to "admin"');
    }
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run the script
console.log('🚀 Firebase Admin Initialization Script');
createAdmin();