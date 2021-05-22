<template>
	<div id="app">
		<select v-model="currentUserId">
			<option v-for="user in users" :key="user._id" :value="user._id">
				{{ user.username }}
			</option>
		</select>
		<button @click="printData">Print data</button>
		<button @click="addData" :disabled="updatingData">Add data</button>
		<button @click="deleteData">Delete data</button>
		<ChatContainer :currentUserId=currentUserId></ChatContainer>
		</div>
</template>

<script>
//TODO: display rooms

import ChatContainer from './components/ChatContainer'
import { usersRef, roomsRef } from '@/firestore'

export default {
	name: 'App',
	components: {
		ChatContainer
	},

	data () {
		return {
			users: [
				{
					_id: '6R0MijpK6M4AIrwaaCY2',
					username: 'Luke',
					avatar: 'https://66.media.tumblr.com/avatar_c6a8eae4303e_512.pnj'
				},
				{
					_id: 'SGmFnBZB4xxMv9V4CVlW',
					username: 'Leia',
					avatar: 'https://avatarfiles.alphacoders.com/184/thumb-184913.jpg'
				},
				{
					_id: '6jMsIXUrBHBj7o2cRlau',
					username: 'Yoda',
					avatar:
						'https://vignette.wikia.nocookie.net/teamavatarone/images/4/45/Yoda.jpg/revision/latest?cb=20130224160049'
				}
			],
			currentUserId: 'SGmFnBZB4xxMv9V4CVlW',
			updatingData: false, 
			showChat: true,
			rooms: []
		}
	},
	methods: {
		async addData() {
			console.log("Adding data currentUserId is ", this.currentUserId)
			this.updatingData = true
			const user1 = this.users[0]
			await usersRef.doc(user1._id).set(user1)
			const user2 = this.users[1]
			await usersRef.doc(user2._id).set(user2)
			//const user3 = this.users[2]
			//await usersRef.doc(user3._id).set(user3)

			await roomsRef.add({
				roomsId: 'ROOM_1',
				users: [user1._id, user2._id],
				lastUpdated: new Date()
			})
/*			await roomsRef.add({
				roomsId: 'ROOM_2',
				users: [user1._id, user3._id],
				lastUpdated: new Date()
			})
			await roomsRef.add({
				roomsId: 'ROOM_3',
				users: [user2._id, user3._id],
				lastUpdated: new Date()
			})
			await roomsRef.add({
				roomsId: 'ROOM_4',
				users: [user1._id, user2._id, user3._id],
				lastUpdated: new Date()
			})
*/
			console.log('Added rooms data')
			this.updatingData = false
		},
		
		async deleteData() {
			usersRef.get().then(user => {
				user.forEach(user =>
					usersRef.doc(user.id).delete()
				)
			}).catch(err => {
				console.log('Error deleting users', err)
			})
			roomsRef.get().then(room => {
				room.forEach(async room => {
					console.log("RoomId ", room.id);
					const ref = roomsRef.doc(room.id).collection('messages')
					await ref.get().then(res => {
						if (res.empty) return
						res.docs.map(doc => ref.doc(doc.id).delete())
					})
					roomsRef.doc(room.id).delete()
				})
			})
		},

		printData() {
			console.log("Current user id ", this.currentUserId);
			usersRef.get()
			.then(user => user.forEach(doc => {
				console.log(doc.data())
			})).catch(err => {
				console.log('Error getting users', err)
			});
			roomsRef.get()
			.then(room => room.forEach(doc => {
				console.log(doc.data())
			})).catch(err => {
				console.log('Error getting rooms', err)
			})
		}
	}
}

</script>


<style>
#app {
	text-align: center;
	margin-top: 60px;
}
</style>
