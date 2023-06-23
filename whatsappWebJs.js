/*
 * Created By : Ahmad Windi Wijayanto
 * Email : ahmadwindiwijayanto@gmail.com
 * Website : https://whendy.net
 * github : https://github.com/whendy
 * LinkedIn : https://www.linkedin.com/in/ahmad-windi-wijayanto/
 *
 */

import whatsappWeb from 'whatsapp-web.js'
import qrcode from "qrcode"
import fs from "fs"
import WADevice from "../models/WADeviceModel.js"
import User from "../models/UserModel.js";

const { Client, LocalAuth } = whatsappWeb

const whatsappClient = (device_uuid) => {
    try {
        const client = new Client({
            restartOnAuthFail: true,
            qrMaxRetries: 2,
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process', // <- this one doesn't works in Windows
                    '--disable-gpu'
                ],
            },
            authStrategy: new LocalAuth({
                clientId: device_uuid
            })
        })

        client.initialize().catch(_ => _)

        return client

    }catch (error) {
        console.log(error)
    }
}

const setConnectingStatusDevice = async (device_uuid, connectingStatus) => {
    try {
        await WADevice.update({
            connecting_status: connectingStatus || 'disconnected'
        }, {
            where: {
                uuid: device_uuid
            }
        })
    }catch (error) {
        console.log(error)
    }
}

const createSessionDevice = async (device_uuid, user_uuid, socketIO) => {
    try {
        console.log("Initial client.")
        const client = await whatsappClient(device_uuid)
        console.log("Finish client.")

        client.on('qr', (qr) => {
            qrcode.toDataURL(qr, (err, url) => {

                setConnectingStatusDevice(device_uuid, 'disconnected')

                console.log("QrCode Received")
                socketIO.emit('wa-qr', {id: device_uuid, user_uuid: user_uuid, src: url})
                socketIO.emit('wa-message-info', {
                    id: device_uuid,
                    user_uuid: user_uuid,
                    message: 'QR Code received, scan please!',
                    status: true
                })
            })
        })

        client.on('ready', () => {

            setConnectingStatusDevice(device_uuid, 'ready')

            console.log('on:wa-connecting-status-ready')
            socketIO.emit('wa-connecting-status-ready', {
                id: device_uuid,
                user_uuid: user_uuid,
                status: true,
                message: 'ready'
            })
            socketIO.emit('wa-message-info', {
                id: device_uuid,
                user_uuid: user_uuid,
                status: true,
                message: 'Whatsapp is ready!'
            })
        })

        client.on('authenticated', () => {

            setConnectingStatusDevice(device_uuid, 'authenticated')

            console.log('on:wa-connecting-status-authenticated')
            socketIO.emit('wa-connecting-status-authenticated', {
                id: device_uuid,
                user_uuid: user_uuid,
                status: true,
                message: 'authenticated'
            })
            socketIO.emit('wa-message-info', {
                id: device_uuid,
                user_uuid: user_uuid,
                status: true,
                message: 'Whatsapp is authenticated!'
            })
        })

        client.on('auth_failure', () => {

            setConnectingStatusDevice(device_uuid, 'auth_failure')

            console.log('on:wa-connecting-status-auth_failure')
            socketIO.emit('wa-connecting-status-auth_failure', {
                id: device_uuid,
                user_uuid: user_uuid,
                status: true,
                message: 'auth_failure'
            })
            socketIO.emit('wa-message-info', {
                id: device_uuid,
                user_uuid: user_uuid,
                status: true,
                message: 'Auth failure, restarting...'
            })
        })

        client.on('disconnected', async (reason) => {
            console.log('on:wa-connecting-status-disconnected')
            socketIO.emit('wa-connecting-status-disconnected', {
                id: device_uuid,
                user_uuid: user_uuid,
                status: true,
                message: 'disconnected'
            })
            socketIO.emit('wa-message-info', {
                id: device_uuid,
                user_uuid: user_uuid,
                status: true,
                message: 'Whatsapp is disconnected!'
            })
            await setConnectingStatusDevice(device_uuid, 'disconnected')
            await client.destroy()
        })
    }catch (error) {
        console.log(error)
    }
}

const clearSessionDevice = async (device_uuid, user_uuid, socketIO) => {
    try {
        console.log("Initial client.")
        const client = await whatsappClient(device_uuid)
        console.log("Finish client.")

        client.on('ready', async () => {
            console.log('on:wa-clear-session')
            console.log('on:wa-connecting-status-disconnected')
            socketIO.emit('wa-connecting-status-disconnected', {
                id: device_uuid,
                user_uuid: user_uuid,
                status: true,
                message: 'disconnected'
            })
            socketIO.emit('wa-message-info', {
                id: device_uuid,
                user_uuid: user_uuid,
                status: true,
                message: 'Whatsapp is disconnected!'
            })
            await setConnectingStatusDevice(device_uuid, 'disconnected')
            await client.logout()
            await client.destroy()
        })
    }catch (error) {
        console.log(error)
    }
}

const whatsappInitialize = async (socket) => {
    try {
        const devices = await WADevice.findAll({
            attributes: ['id', 'uuid', 'user_id'],
            where: {
                status: 'active'
            },
            include: [
                {
                    model: User,
                    attributes: ['uuid']
                }
            ]
        })
        if (devices) {
            const results = devices.map(result => result.dataValues)
            results.forEach((data) => {
                createSessionDevice(data.uuid, data.user.uuid, socket, false)
            })
        }
    }catch (error) {
        console.log(error)
    }
}

export {
    whatsappClient,
    setConnectingStatusDevice,
    createSessionDevice,
    whatsappInitialize,
    clearSessionDevice
}
