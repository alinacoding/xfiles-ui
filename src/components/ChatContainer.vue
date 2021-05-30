<template>
	<div class="window-container">
		<form @submit.prevent="createRoom" v-if="addNewRoom">
			<input type="text" placeholder="Add username" v-model="addRoomUsername" />
			<button type="submit" :disabled="disableForm || !addRoomUsername">
				Create Room
			</button>
			<button class="button-cancel" @click="addNewRoom = false">
				Cancel
			</button>
		</form>

		<form @submit.prevent="addRoomUser" v-if="inviteRoomId">
			<input type="text" placeholder="Add username" v-model="invitedUsername" />
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
		:styles="styles"
		:theme="theme"
		:responsive-breakpoint="200"
		:current-user-id="currentUserId"
		:rooms="rooms"
		:room-id="roomId"
		:rooms-loaded="roomsLoaded"
		@add-room="addRoom"
		:showAddRoom="showAddRoom"
		:show-add-room="showAddRoom"
		:loadingRooms="loadingRooms"
		:room-actions="roomActions"
		:room-message="roomMessage"
		:messages="messages"
		@send-message="sendMessage"
		:messagesLoaded="messagesLoaded"
		@fetchMessages="fetchMessages"
		@edit-message="editMessage"
		@delete-message="deleteMessage"
		@typingMessage="typingMessage"
		@openFile="openFile"
		@fetch-more-rooms="fetchMoreRooms"
		@sendMessageReaction="sendMessageReaction"
		@fetch-messages="fetchMessages"
		:menu-actions="menuActions"
		@toggle-rooms-list="$emit('show-demo-options', $event.opened)"
		@room-action-handler="menuActionHandler"
		@menu-action-handler="menuActionHandler"
		@open-user-tag="openUserTag"
		:textMessages="textMessages"
		/>
	</div>
</template>

<script>

import ChatWindow from 'vue-advanced-chat';
import 'vue-advanced-chat/dist/vue-advanced-chat.css';
import { roomsRef, usersRef, firebase, filesRef, messagesRef, deleteDbField } from '@/firestore'
import { parseTimestamp, isSameDay } from '../utils/dates'


export default {

	components: {
		ChatWindow
	},

	data() {
		return {
			roomsPerPage: 10,
			rooms: [],
			roomId: '',
			startRooms: null,
			endRooms: null,
			roomsLoaded: false,
			loadingRooms: true,
			allUsers: [],
			loadingLastMessageByRoom: 0,
			roomsLoadedCount: false,
			selectedRoom: null,
			messagesPerPage: 20,
			messages: [],
			messagesLoaded: false,
			roomMessage: '',
			startMessages: null,
			endMessages: null,
			roomsListeners: [],
			listeners: [],
			typingMessageCache: '',
			disableForm: true,
			addNewRoom: null,
			addRoomUsername: '',
			inviteRoomId: null,
			invitedUsername: '',
			removeRoomId: null,
			removeUserId: '',
			removeUsers: [],
			showAddRoom:true,
			menuActions: [
				{ name: 'inviteUser', title: 'Invite User' },
				{ name: 'removeUser', title: 'Remove User' },
				{ name: 'deleteRoom', title: 'Delete Room' }],
				roomActions: [
					{ name: 'inviteUser', title: 'Invite User' },
					{ name: 'removeUser', title: 'Remove User' },
					{ name: 'deleteRoom', title: 'Delete Room' }
				],
				styles: { container: { borderRadius: '4px' } },
				textMessages: {
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
			}
		},

		props: ['currentUserId', 'theme', 'isDevice'],

		mounted() {
			this.fetchRooms()
			this.updateUserOnlineStatus()
		},

		destroyed() {
			this.resetRooms()
		},

		computed: {
			loadedRooms() {
				return this.rooms.slice(0, this.roomsLoadedCount)
			}
		},

		methods: {

			async openUserTag({ user }) {
				let roomId
				this.rooms.forEach(room => {
					if (room.users.length === 2) {
						const userId1 = room.users[0]._id
						const userId2 = room.users[1]._id
						if (
							(userId1 === user._id || userId1 === this.currentUserId) &&
							(userId2 === user._id || userId2 === this.currentUserId)
						) {
							roomId = room.roomId
						}
					}
				})
				if (roomId) return (this.roomId = roomId)
				const query1 = await roomsRef
				.where('users', '==', [this.currentUserId, user._id])
				.get()
				if (!query1.empty) {
					return this.loadRoom(query1)
				}
				let query2 = await roomsRef
				.where('users', '==', [user._id, this.currentUserId])
				.get()
				if (!query2.empty) {
					return this.loadRoom(query2)
				}
				const room = await roomsRef.add({
					users: [user._id, this.currentUserId],
					lastUpdated: new Date()
				})
				this.roomId = room.id
				this.fetchRooms()
			},


			async sendMessageReaction({reaction, remove, messageId, roomId}) {
				const dbAction = remove
				? firebase.firestore.FieldValue.arrayRemove(this.currentUserId)
				: firebase.firestore.FieldValue.arrayUnion(this.currentUserId)
				await this.messagesRef(roomId)
				.doc(messageId)
				.update({
					[`reactions.${reaction.name}`]: dbAction
				})
			},

			async editMessage({ messageId, newContent, roomId, file }) {
				const newMessage = { edited: new Date() }
				newMessage.content = newContent
				if (file) {
					newMessage.file = {
						name: file.name,
						size: file.size,
						type: file.type,
						extension: file.extension || file.type,
						url: file.url || file.localUrl
					}
					if (file.audio) {
						newMessage.file.audio = true
						newMessage.file.duration = file.duration
					}
				} else {
					newMessage.file = deleteDbField
				}
				await messagesRef(roomId)
				.doc(messageId)
				.update(newMessage)
				if (file?.blob) this.uploadFile({ file, messageId, roomId })
			},

			async deleteMessage({ message, roomId }) {
				await messagesRef(roomId)
				.doc(message._id)
				.update({ deleted: new Date() })
				const { file } = message
				if (file) {
					const deleteFileRef = filesRef
					.child(this.currentUserId)
					.child(message._id)
					.child(`${file.name}.${file.extension || file.type}`)
					await deleteFileRef.delete()
				}
			},

			async deleteRoom(roomId) {
				const room = this.rooms.find(r => r.roomId === roomId)
				if (
					room.users.find(user => user._id === 'SGmFnBZB4xxMv9V4CVlW') ||
					room.users.find(user => user._id === '6jMsIXUrBHBj7o2cRlau')
				) {
					return alert('Nope, for demo purposes you cannot delete this room')
				}
				const ref = messagesRef(roomId)
				ref.get().then(res => {
					if (res.empty) return
					res.docs.map(doc => ref.doc(doc.id).delete())
				})
				await roomsRef.doc(roomId).delete()
				this.fetchRooms()
			},

			removeUser(roomId) {
				this.resetForms()
				this.removeRoomId = roomId
				this.removeUsers = this.rooms.find(room => room.roomId === roomId).users
			},

			async deleteRoomUser() {
				this.disableForm = true
				await roomsRef.doc(this.removeRoomId).update({
					users: firebase.firestore.FieldValue.arrayRemove(this.removeUserId)
				})
				this.removeRoomId = null
				this.removeUserId = ''
				this.fetchRooms()
			},

			menuActionHandler({ action, roomId }) {
				switch (action.name) {
					case 'inviteUser':
					return this.inviteUser(roomId)
					case 'removeUser':
					return this.removeUser(roomId)
					case 'deleteRoom':
					return this.deleteRoom(roomId)
				}
			},

			inviteUser(roomId) {
				this.resetForms()
				this.inviteRoomId = roomId
			},

			formatMessage(room, message) {
				const senderUser = room.users.find(
					user => message.data().sender_id === user._id
				)
				const { sender_id, timestamp } = message.data()
				return {
					...message.data(),
					...{
						senderId: sender_id,
						_id: message.id,
						seconds: timestamp.seconds,
						timestamp: parseTimestamp(timestamp, 'HH:mm'),
						date: parseTimestamp(timestamp, 'DD MMMM YYYY'),
						username: senderUser ? senderUser.username : null,
						avatar: senderUser ? senderUser.avatar : null,
						distributed: true
					}
				}
			},

			listenMessages(messages, room) {
				messages.forEach(message => {
					const formattedMessage = this.formatMessage(room, message)
					const messageIndex = this.messages.findIndex(m => m._id === message.id)
					if (messageIndex === -1) {
						this.messages = this.messages.concat([formattedMessage])
					} else {
						this.$set(this.messages, messageIndex, formattedMessage)
					}
					this.markMessagesSeen(room, message)
				})
			},

			markMessagesSeen(room, message) {
				if (
					message.data().sender_id !== this.currentUserId &&
					(!message.data().seen || !message.data().seen[this.currentUserId])
				) {
					messagesRef(room.roomId)
					.doc(message.id)
					.update({
						[`seen.${this.currentUserId}`]: new Date()
					})
				}
			},

			resetRooms() {
				this.loadingRooms = true
				this.loadingLastMessageByRoom = 0
				this.roomsLoadedCount = 0
				this.rooms = []
				this.roomsLoaded = true
				this.startRooms = null
				this.endRooms = null
				this.roomsListeners.forEach(listener => listener())
				this.roomsListeners = []
				this.resetMessages()
			},

			async fetchRooms() {
				this.resetRooms()
				this.fetchMoreRooms()
			},

			async fetchMoreRooms() {
				if (this.endRooms && !this.startRooms) return (this.roomsLoaded = true)
				let query = roomsRef
				.where('users', 'array-contains', this.currentUserId)
				.orderBy('lastUpdated', 'desc')
				.limit(this.roomsPerPage)
				console.log("QUERY", query)
				if (this.startRooms) query = query.startAfter(this.startRooms)
				const rooms = await query.get()
				console.log("ROOMS ", rooms)
				// this.incrementDbCounter('Fetch Rooms', rooms.size)
				this.roomsLoaded = rooms.empty || rooms.size < this.roomsPerPage
				if (this.startRooms) this.endRooms = this.startRooms
				this.startRooms = rooms.docs[rooms.docs.length - 1]
				const roomUserIds = []
				rooms.forEach(room => {
					console.log(room.data())
					room.data().users.forEach(userId => {
						console.log("USER ID", userId)
						console.log("ALL USERS ", this.allUsers)
						for (let usr of this.allUsers) {
							console.log("************* ", usr);
						}
						const foundUser = this.allUsers.find(user => user._id === userId)
						if (!foundUser && roomUserIds.indexOf(userId) === -1) {
							roomUserIds.push(userId)
						}
					})
				})
				// this.incrementDbCounter('Fetch Room Users', roomUserIds.length)
				const rawUsers = []
				roomUserIds.forEach(userId => {
					const promise = usersRef
					.doc(userId)
					.get()
					.then(user => user.data())
					rawUsers.push(promise)
				})
				this.allUsers = [...this.allUsers, ...(await Promise.all(rawUsers))]
				console.log(this.allUsers.length)
				const roomList = {}
				rooms.forEach(room => {
					console.log(this.allUsers)
					roomList[room.id] = { ...room.data(), users: [] }
					console.log(room.id	)
					room.data().users.forEach(userId => {
						console.log("THIS IS ",userId)
						const foundUser = this.allUsers.find(user => user._id === userId)
						console.log("Found user ", foundUser)
						if (foundUser) roomList[room.id].users.push(foundUser)
					})
				})
				const formattedRooms = []
				Object.keys(roomList).forEach(key => {
					const room = roomList[key]
					console.log("ROOM ", room)
					const roomContacts = room.users.filter(
						user => user._id !== this.currentUserId
					)
					console.log("ROOM CONTACTS ", roomContacts)
					room.roomName =
					roomContacts.map(user => user.username).join(', ') || 'Myself'
					console.log("ROOM NAME ", room.roomName)
					const roomAvatar =
					roomContacts.length === 1 && roomContacts[0].avatar
					? roomContacts[0].avatar
					: this.allUsers[0].avatar //require('../../assets/leia.jpg')
					formattedRooms.push({
						...room,
						roomId: key,
						avatar: roomAvatar,
						index: room.lastUpdated.seconds,
						lastMessage: {
							content: 'Room created',
							timestamp: this.formatTimestamp(
								new Date(room.lastUpdated.seconds),
								room.lastUpdated
							)
						}
					})
				})
				this.rooms = this.rooms.concat(formattedRooms)
				formattedRooms.map(room => this.listenLastMessage(room))
				if (!this.rooms.length) {
					this.loadingRooms = false
					this.roomsLoadedCount = 0
				}
				this.listenUsersOnlineStatus(formattedRooms)
				this.listenRooms(query)
				// setTimeout(() => console.log('TOTAL', this.dbRequestCount), 2000)
			},

			formatTimestamp(date, timestamp) {
				const timestampFormat = isSameDay(date, new Date()) ? 'HH:mm' : 'DD/MM/YY'
				const result = parseTimestamp(timestamp, timestampFormat)
				return timestampFormat === 'HH:mm' ? `Today, ${result}` : result
			},

			async listenRooms(query) {
				const listener = query.onSnapshot(rooms => {
					// this.incrementDbCounter('Listen Rooms Typing Users', rooms.size)
					rooms.forEach(room => {
						const foundRoom = this.rooms.find(r => r.roomId === room.id)
						if (foundRoom) {
							foundRoom.typingUsers = room.data().typingUsers
							foundRoom.index = room.data().lastUpdated.seconds
						}
					})
				})
				this.roomsListeners.push(listener)
			},

			openFile(message) {
				window.open(message.file.url, '_blank')
			},

			async uploadFile({file, messageId, roomId}) {
				console.log(firebase.auth())
				const uploadFileRef = filesRef
				.child(this.currentUserId)
				.child(messageId)
				.child(`${file.name}.${file.type}`)
				await uploadFileRef.put(file.blob, {contentType: file.type})
				const url = await uploadFileRef.getDownloadURL()
				await this.messagesRef(roomId)
				.doc(messageId)
				.update({
					['file.url']: url
				})
			},

			fetchMessages({ room, options = {} }) {
				this.$emit('show-demo-options', false)
				if (options.reset) {
					this.resetMessages()
					this.roomId = room.roomId
				}
				if (this.endMessages && !this.startMessages)
				return (this.messagesLoaded = true)
				let ref = messagesRef(room.roomId)
				let query = ref.orderBy('timestamp', 'desc').limit(this.messagesPerPage)
				if (this.startMessages) query = query.startAfter(this.startMessages)
				this.selectedRoom = room.roomId
				query.get().then(messages => {
					// this.incrementDbCounter('Fetch Room Messages', messages.size)
					if (this.selectedRoom !== room.roomId) return
					if (messages.empty) this.messagesLoaded = true
					if (this.startMessages) this.endMessages = this.startMessages
					this.startMessages = messages.docs[messages.docs.length - 1]
					let listenerQuery = ref.orderBy('timestamp')
					if (this.startMessages)
					listenerQuery = listenerQuery.startAfter(this.startMessages)
					if (this.endMessages)
					listenerQuery = listenerQuery.endAt(this.endMessages)
					if (options.reset) this.messages = []
					messages.forEach(message => {
						const formattedMessage = this.formatMessage(room, message)
						this.messages.unshift(formattedMessage)
					})
					const listener = listenerQuery.onSnapshot(snapshots => {
						// this.incrementDbCounter('Listen Room Messages', snapshots.size)
						this.listenMessages(snapshots, room)
					})
					this.listeners.push(listener)
				})
			},

			updateUserOnlineStatus() {
				const userStatusRef = firebase
				.database()
				.ref('/status/' + this.currentUserId)
				const isOfflineData = {
					state: 'offline',
					last_changed: firebase.database.ServerValue.TIMESTAMP
				}
				const isOnlineData = {
					state: 'online',
					last_changed: firebase.database.ServerValue.TIMESTAMP
				}
				firebase
				.database()
				.ref('.info/connected')
				.on('value', snapshot => {
					if (snapshot.val() == false) return
					userStatusRef
					.onDisconnect()
					.set(isOfflineData)
					.then(() => {
						userStatusRef.set(isOnlineData)
					})
				})
			},

			typingMessage({message, roomId}) {
				const dbAction = message
				? firebase.firestore.FieldValue.arrayUnion(this.currentUserId)
				: firebase.firestore.FieldValue.arrayRemove(this.currentUserId)
				roomsRef.doc(roomId).update({
					typingUsers: dbAction
				})
			},

			resetMessages() {
				this.messages = []
				this.messagesLoaded = false
				this.startMessages = null
				this.endMessages = null
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

			listenLastMessage(room) {
				const listener = messagesRef(room.roomId)
				.orderBy('timestamp', 'desc')
				.limit(1)
				.onSnapshot(messages => {
					// this.incrementDbCounter('Listen Last Room Message', messages.size)
					messages.forEach(message => {
						const lastMessage = this.formatLastMessage(message.data())
						const roomIndex = this.rooms.findIndex(
							r => room.roomId === r.roomId
						)
						this.rooms[roomIndex].lastMessage = lastMessage
						this.rooms = [...this.rooms]
					})
					if (this.loadingLastMessageByRoom < this.rooms.length) {
						this.loadingLastMessageByRoom++
						if (this.loadingLastMessageByRoom === this.rooms.length) {
							this.loadingRooms = false
							this.roomsLoadedCount = this.rooms.length
						}
					}
				})
				this.roomsListeners.push(listener)
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
					sender_id: this.currentUserId,
					content,
					timestamp: new Date()
				}
				if (file) {
					message.file = {
						name: file.name,
						size: file.size,
						type: file.type,
						extension: file.extension || file.type,
						url: file.localUrl
					}
					if (file.audio) {
						message.file.audio = true
						message.file.duration = file.duration
					}
				}
				if (replyMessage) {
					message.replyMessage = {
						_id: replyMessage._id,
						content: replyMessage.content,
						sender_id: replyMessage.senderId
					}
					if (replyMessage.file) {
						message.replyMessage.file = replyMessage.file
					}
				}
				const { id } = await messagesRef(roomId).add(message)
				if (file) this.uploadFile({ file, messageId: id, roomId })
				roomsRef.doc(roomId).update({ lastUpdated: new Date() })
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
				this.addNewRoom = false
				this.addRoomUsername = ''
				this.inviteRoomId = null
				this.invitedUsername = ''
				this.removeRoomId = null
				this.removeUserId = ''
			},

			async addRoomUser() {
				console.log("ADDING ROOM USER!")
				this.disableForm = true
				const { id } = await usersRef.add({ username: this.invitedUsername })
				await usersRef.doc(id).update({ _id: id })
				await roomsRef
				.doc(this.inviteRoomId)
				.update({ users: firebase.firestore.FieldValue.arrayUnion(id) })
				this.inviteRoomId = null
				this.invitedUsername = ''
				this.fetchRooms()
			},


			async createRoom() {
				console.log("CREATING ROOMS")
				this.disableForm = true
				const { id } = await usersRef.add({ username: this.addRoomUsername })
				await usersRef.doc(id).update({ _id: id })
				await roomsRef.add({
					users: [id, this.currentUserId],
					lastUpdated: new Date()
				})
				this.addRoomUsername = ''
				await this.fetchRooms()
			}
		}
	}
</script>

<style lang="scss" scoped>
	.window-container {
		width: 100%;
	}
	.window-mobile {
		form {
			padding: 0 10px 10px;
		}
	}
	form {
		padding-bottom: 20px;
	}
	input {
		padding: 5px;
		width: 140px;
		height: 21px;
		border-radius: 4px;
		border: 1px solid #d2d6da;
		outline: none;
		font-size: 14px;
		vertical-align: middle;
		&::placeholder {
			color: #9ca6af;
		}
	}
	button {
		background: #1976d2;
		color: #fff;
		outline: none;
		cursor: pointer;
		border-radius: 4px;
		padding: 8px 12px;
		margin-left: 10px;
		border: none;
		font-size: 14px;
		transition: 0.3s;
		vertical-align: middle;
		&:hover {
			opacity: 0.8;
		}
		&:active {
			opacity: 0.6;
		}
		&:disabled {
			cursor: initial;
			background: #c6c9cc;
			opacity: 0.6;
		}
	}
	.button-cancel {
		color: #a8aeb3;
		background: none;
		margin-left: 5px;
	}
	select {
		vertical-align: middle;
		height: 33px;
		width: 152px;
		font-size: 13px;
		margin: 0 !important;
	}
</style>
