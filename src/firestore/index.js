import app from 'firebase/app'
import 'firebase/firestore'
import 'firebase/database'
import 'firebase/storage'

const config = {
	apiKey: "AIzaSyCJIkxx9FZGz8VkqNAFK8_cWbcfhoE6G7g",
	authDomain: "xfiles-ui.firebaseapp.com",
	projectId: "xfiles-ui",
	storageBucket: "xfiles-ui.appspot.com",
	messagingSenderId: "425418248200",
	appId: "1:425418248200:web:3f074646f1b225c49e01bd",
	measurementId: "G-BYFSMGQL85"
}

app.initializeApp(config)

export const firebase = app
export const db = app.firestore()

export const usersRef = db.collection('users')
export const roomsRef = db.collection('chatRooms')
export const getMessagesRef = roomId => roomsRef.doc(roomId).collection('messages')

