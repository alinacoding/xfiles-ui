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

			<form @submit.prevent="addRoomUser" v-if="inviteRoomId">
				<input
					type="text"
					placeholder="Add user to the room"
					v-model="invitedUsername"
				/>
				<button type="submit" :disabled="disableForm || !invitedUsername">
					Add User
				</button>
				<button class="button-cancel" @click="inviteRoomId = null">
					Cancel
				</button>
			</form>

			<form @submit.prevent="deleteRoomUser" v-if="removeRoomId">
				<select v-model="removeUserId">
					<option default value="">Select User</option>
					<option v-for="user in removeUsers" :key="user._id" :value="user._id">
						{{ user.username }}
					</option>
				</select>
				<button type="submit" :disabled="disableForm || !removeUserId">
					Remove User
				</button>
				<button class="button-cancel" @click="removeRoomId = null">
					Cancel
				</button>
			</form>

		<chat-window
			current-user-id="currentUserId"
			:rooms="rooms"
			:messages="messages"
			@send-message="sendMessage"
			@add-room="addRoom"
			:showAddRoom="showAddRoom"
			:responsive-breakpoint="200"
			:rooms-loaded="roomsLoaded"
		/>
	</div>
</template>

<script>

	import ChatWindow from 'vue-advanced-chat';
	import 'vue-advanced-chat/dist/vue-advanced-chat.css';
	import { roomsRef, usersRef, firebase } from '@/firestore'
	import { eventBus } from '../main'
	import { parseTimestamp, isSameDay } from '../utils/dates'

	export default {
		components: {
			ChatWindow
		},
		data() {
			return {
				rooms: [{
					//roomId: '1',
					roomName: 'Room 1',
					avatar: 'https://avatarfiles.alphacoders.com/184/thumb-184913.jpg',
					users: [
						{ _id: 1, username: 'Luke' },
						{ _id: 2, username: 'Leia' }
					]
				}],
				messages: [{
					_id: 1,
					content: 'hi there',
					senderId: 2,
					username: 'Luke',
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
						type: 'jpg',
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
							1
						]}
					}],
				updatingData: false,
				addNewRoom: null,
				disableForm: false,
				addRoomUsername: '',
				showAddRoom: true,
				roomsLoaded: false,
				removeRoomId: null,
				inviteRoomId: null,
				roomsListeners: [],
				listeners: [],
				invitedUsername: '',
				start: null,
				end: null

/*				textMessages: {
					ROOMS_EMPTY: 'No rooms',
					ROOM_EMPTY: 'No room selected',
					NEW_MESSAGES: 'New Messages',
					MESSAGE_DELETED: 'This message was deleted',
					MESSAGES_EMPTY: 'No messages',
					CONVERSATION_STARTED: 'Conversation started on:',
					TYPE_MESSAGE: 'Type message',
					SEARCH: 'Search',
					IS_ONLINE: 'is online',
					LAST_SEEN: 'last seen ',
					IS_TYPING: 'is writing...'
				}
*/
			}
		},

		props: ['currentUserId'],

		methods: {

			resetRooms() {
				this.loadingRooms = true
				this.rooms = []
				this.roomsListeners.forEach(listener => listener())
				this.resetMessages()
			},

			resetMessages() {
				this.messages = []
				this.messagesLoaded = false
				this.start = null
				this.end = null
				this.listeners.forEach(listener => listener())
				this.listeners = []
			},

			messagesRef(roomId) {
				return roomsRef.doc(roomId).collection('messages')
			},

			async listenRoomsTypingUsers(query) {
				query.onSnapshot(rooms => {
					rooms.forEach(room => {
					const foundRoom = this.rooms.find(r => r.roomId === room.id)
					if (foundRoom)
						foundRoom.typingUsers = room.data().typingUsers
					})
				})
			},

			formatLastMessage(message) {
				if (!message.timestamp) return
				const date = new Date(message.timestamp.seconds * 1000)
				const timestampFormat = isSameDay(date, new Date()) ? 'HH:mm' : 'DD/MM/YY'
				let timestamp = parseTimestamp(message.timestamp, timestampFormat)
				if (timestampFormat === 'HH:mm') timestamp = `Today, ${timestamp}`
				let content = message.content
				if (message.file) content = `${message.file.name}.${message.file.type}`
				return {
						...message,
						...{
								content,
								timestamp,
								date: message.timestamp.seconds,
								seen: message.sender_id === this.currentUserId ? message.seen : null,
								new:
										message.sender_id !== this.currentUserId &&
										(!message.seen || !message.seen[this.currentUserId])
						}
				}
			},

			listenLastMessage(room, index) {
					const listener = this.messagesRef(room.roomId)
							.orderBy('timestamp', 'desc')
							.limit(1)
							.onSnapshot(messages => {
									messages.forEach(message => {
											const lastMessage = this.formatLastMessage(message.data())
											this.rooms[index].lastMessage = lastMessage
									})
							})
					this.roomsListeners.push(listener)
			},

			async fetchRooms() {
				this.resetRooms()
					const query = roomsRef.where(
					'users',
					'array-contains',
					this.currentUserId
				)

				const rooms = await query.get()
				const roomList = []
				const rawRoomUsers = []
				const rawMessages = []
				rooms.forEach(room => {
					roomList[room.id] = {...room.data(), users: []}
					const rawUsers = []
					room.data().users.map(userId => {
						const promise = usersRef
							.doc(userId)
							.get()
							.then(user => {
								return {
									...user.data(),
									...{
										roomId: room.id,
										username: user.data().username
									}
								}
							})
							rawUsers.push(promise)
						})

						rawUsers.map(users => rawRoomUsers.push(users))
						rawMessages.push(this.getLastMessage(room))
				})

				const users = await Promise.all(rawRoomUsers)
				users.map(user => roomList[user.roomId].users.push(user))
				const roomMessages = await Promise.all(rawMessages).then(messages => {
					return messages.map(message => {
						return {
							lastMessage: this.formatLastMessage(message),
							roomId: message.roomId
						}
					})
				})
				roomMessages.map(ms => (roomList[ms.roomId].lastMessage = ms.lastMessage))
				const formattedRooms = []
				Object.keys(roomList).forEach(key => {
					const room = roomList[key]
					const roomContacts = room.users.filter(
						user => user._id !== this.currentUserId
					)
					room.roomName = roomContacts.map(user => user.username).join(', ') || 'Myself'
					formattedRooms.push({
						...{
							roomId: key,
							...room
						}
					})
				})
				this.rooms = this.rooms.concat(formattedRooms)
				this.loadingRooms = false
				this.rooms.map((room, index) => this.listenLastMessage(room, index))
				this.listenUsersOnlineStatus()
				this.listenRoomsTypingUsers(query)
			},

			getLastMessage(room) {
				return this.messagesRef(room.id)
					.orderBy('timestamp', 'desc')
					.limit(1)
					.get()
					.then(messages => {
							const array = []
								messages.forEach(m => array.push(m.data()))
								return {...array[0], roomId: room.id}
					})
			},

			async loadRoom(query) {
				query.forEach(async room => {
					if (this.loadingRooms) return
					await roomsRef.doc(room.id).update({ lastUpdated: new Date() })
					this.roomId = room.id
					this.fetchRooms()
				})
			},

			listenUsersOnlineStatus() {
					this.rooms.map(room => {
							room.users.map(user => {
									firebase
											.database()
											.ref('/status/' + user._id)
											.on('value', snapshot => {
													if (!snapshot.val()) return
													const timestampFormat = isSameDay(
															new Date(snapshot.val().last_changed),
															new Date()
													)
															? 'HH:mm'
															: 'DD MMMM, HH:mm'
													const timestamp = parseTimestamp(
															new Date(snapshot.val().last_changed),
															timestampFormat
													)
													const last_changed =
															timestampFormat === 'HH:mm' ? `today, ${timestamp}` : timestamp
													user.status = {...snapshot.val(), last_changed}
													const roomIndex = this.rooms.findIndex(
															r => room.roomId === r.roomId
													)
													this.$set(this.rooms, roomIndex, room)
											})
							})
					})
			},

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
						console.log(err)
					})
				}
			},

			addRoom() {
				this.resetForms(),
				this.addNewRoom = true
			},

			resetForms() {
				this.disableForm = false
				this.addNewRoom = null
				this.addRoomUsername = ''
				this.inviteRoomId = null
				this.invitedUsername = ''
				this.removeRoomId = null
				this.removeUserId = ''
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
				await this.fetchRooms()
			}
		}
	}
</script>
