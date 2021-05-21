<template>
	<div class="chat">
	<button @click="greetUsers">Greet users</button>
	<chat-window
		current-user-id="currentUserId"
		:rooms="rooms"
		:messages="messages"
		@send-message="sendMessage"
		@greet-users="greetUsers"
	/>
	</div>
</template>

<script>
	import ChatWindow from 'vue-advanced-chat';
	import 'vue-advanced-chat/dist/vue-advanced-chat.css';
	import { roomsRef, getMessagesRef } from '@/firestore'

	export default {
		components: {
			ChatWindow
		},
		data() {
			return {
				rooms: [],
				messages: [],
				roomId: '1',
			}	
		},

		props: ['currentUserId'],

		methods: {

			async sendMessage({ content, roomId}) {
				console.log("Sending message from ", this.currentUserId)
				const msg = {
					senderId: this.currentUserId,
					timestamp: new Date(),
					content: content
				}
				console.log(msg)
				await getMessagesRef(roomId).add(msg)
				roomsRef.doc(roomId).set({'messages': msg, lastUpdated: new Date() })
			},

			greetUsers() {
				if (!roomsRef.empty){
					roomsRef.get()
					.then(room => room.forEach(doc => {
						this.sendMessage({roomsId: doc.data().roomsId, content: 'Hi'})
					}))
					.catch(err => {
						console.log('Error deleting users', err)
					})
				}
			}
		}, 

	}	
</script>
