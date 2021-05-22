<template>
	<div class="chat">
		<form @submit.prevent="createRoom" v-if="addNewRoom">
			<input
				type="text"
				placeholder="Add username to create a room"
				v-model="addRoomUsername"
			/>
			<button type="submit" :disabled="disableForm || !addRoomUsername">
				Create Room
			</button>

			<button class="button-cancel" @click="addNewRoom = false">
				Cancel
			</button>
		</form>
		<chat-window
			current-user-id="currentUserId"
			:rooms="rooms"
			:messages="messages"
			:rooms-loaded="true"
			@send-message="sendMessage"
			@add-room="addRoom"
			:showAddRoom="showAddRoom"
			:responsive-breakpoint="200"

		/>
	</div>
</template>

<script>
	//<button @click="greetUsers">Greet users</button>
	import ChatWindow from 'vue-advanced-chat';
	import 'vue-advanced-chat/dist/vue-advanced-chat.css';
	import { roomsRef, usersRef } from '@/firestore'	
	import { eventBus } from '../main'

	export default {
		components: {
			ChatWindow
		},
		data() {
			return {
				rooms: [{
					roomId: 1,
					roomName: 'Room 1',
					avatar: '../../assets/leia.jpg',
					users: [
						{ _id: 1, username: 'Alina' },
						{ _id: 2, username: 'Eliza' }
					]
				}],
				messages: [{
					_id: 7890,
					content: 'message 1',
					senderId: 1234,
					username: 'John Doe',
					avatar:'',
					date: '13 November',
					timestamp: '10:20',
					system: false,
					saved: true,
					distributed: true,
					seen: true,
					disableActions: false,
					disableReactions: false,
					file: {
						name: 'My File',
						size: 67351,
						type: 'png',
						audio: true,
						duration: 14.4,
						url: 'h',
						preview: ''
					},
					reactions: {
						wink: [
							1, // USER_ID
							2
						],
						laughing: [
							1234
						]}
					}],
				updatingData: false,
				addNewRoom: null,
				disableForm: false,
				addRoomUsername: '',
				showAddRoom: true
			}	
		},

		props: ['currentUserId'],

		methods: {

			async sendMessage({ content, roomId, file, replyMessage }) {
				const message = {
					contentType: 0,
					sender_id: this.currentUserId,
					content,
					timestamp: new Date()	
				}
				if (file) {
					message.file = {
					name: file.name,
					size: file.size,
					type: file.type,
					url: file.localUrl
					}
				}
				if (replyMessage) {
					message.replyMessage = {
					_id: replyMessage._id,
					content: replyMessage.content,
					sender_id: replyMessage.sender_id
					}
					if (replyMessage.file) {
						message.replyMessage.file = replyMessage.file;
					}
				}
				const { id } = await this.messagesRef(roomId).add(message);
				const room = this.rooms.find(x => x.roomId === roomId);
				await this.messagesRef(roomId)
					.doc(id)
					.update({
					id: id
				});
				const isRead = {};
				for (const roomUser of room.users) {
					console.log("roomUser", roomUser);
					isRead[roomUser._id] = false;
				}
				console.log("isRead", isRead);
				await roomsRef.doc(roomId).update({
					isRead: isRead,
					lastMessage: content,
					timestamp: new Date()	
				});
				eventBus.$emit(
				"sendMessage",
					this.rooms.find(room => room.roomId === roomId)
				);
				console.log("sendMessage", { content, roomId, file, replyMessage });
					if (file) this.uploadFile({ file, messageId: id, roomId });
				},		

			greetUsers() {
				if (!roomsRef.empty){
					roomsRef.get()
					.then(room => room.forEach(doc => {
						this.updatingData = true;
						this.sendMessage({roomsId: doc.data().roomsId, content: 'Hi'})
						this.updatingData = false;
					}))
					.catch(err => {
						console.log('Error deleting users', err)
					})
				}
			},

			addRoom() {
				this.addNewRoom = true
			},

			async createRoom() {
				this.disableForm = true
				const { id } = await usersRef.add({ username: this.addRoomUsername })
				await usersRef.doc(id).update({ _id: id })
				await roomsRef.add({
					users: [id, this.currentUserId],
					lastUpdated: new Date()
				})
				this.addNewRoom = false
				this.addRoomUsername = ''
			}

		}

	}	
</script>
