const express = require('express')
require('dotenv').config()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const app = express()
const port = process.env.PORT || 5000

//default middlewares
app.use(cookieParser())
app.use(express.json())
app.use(
    cors({
        origin: ['http://localhost:5173', 'https://repair-ranger.web.app'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    })
)

// Custom midddlewares
function verifyToken(req, res, next) {
    const token = req.cookies.myToken;
    // console.log(token)
    if (!token) {
        return res.status(401).send({ message: 'You are anauthorize' })
    }
    // token asche but ulata palta token dile app crash hoye jai!
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log(err)
            res.status(403).send({ message: 'Forbidden to access' })
        }
        req.user = decoded
        next()
    })
}

function verifyUser(req, res, next) {
    if (req?.user?.uid !== req?.params?.uid) {
        return res.status(403).send({ message: 'Why give others data?' })
    }
    next()
}


app.get('/', (req, res) => {
    res.send('Hello World! Wellcome to Repair Ranger')
})

const cookieOptions = {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    secure: process.env.NODE_ENV === 'production' ? true : false
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// const uri = `mongodb+srv://practice_user:practice_user@cluster0.jt5df8u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jt5df8u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const database = client.db('repair_rangers_db_2')
        const userColl = database.collection('users');
        const serviceColl = database.collection('services')
        const bookingColl = database.collection('bookings')
        const marqueeColl = database.collection('marquee_services')

        // Auth related APIs:
        app.post('/login', (req, res) => {
            const user = req.body
            // console.log(user)
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' })
            res
                .cookie('myToken', token, cookieOptions)
                .send({ success: true })
        })

        app.post('/logout', (req, res) => {
            // console.log(req.body)
            res.clearCookie('myToken', { ...cookieOptions, maxAge: 0 }).send({ success: true })
        })


        // Service related APIs:
        app.get('/services', async (req, res) => {
            let query = {}
            let sort = { _id: -1 }
            let limit = 0;
            if (req.query.limit) {
                limit = parseInt(req.query.limit)
            }
            // console.log(req.query)
            if (req.query.search) {
                let serviceName = req.query.search.trim()
                // console.log(serviceName)
                query = { service_name: { $regex: serviceName, $options: 'i' } }
            }
            const cursor = serviceColl.find(query).sort(sort).limit(limit)
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/services/detail/:id', async (req, res) => {
            const id = req.params.id
            // console.log(id, 'er data dao')
            const query = { _id: new ObjectId(id) }
            const item = await serviceColl.findOne(query)
            // console.log(item)
            if (item === null) {
                return res.status(404).json({ message: "service not found" });
            }
            res.send(item)
        })

        app.get('/booked-services/:uid', verifyToken, verifyUser, async (req, res) => {
            let sort = { _id: -1 }
            const uid = req.params.uid;
            const query = { userUid: uid };
            const result = await bookingColl.find(query).sort(sort).toArray()
            res.send(result)
        })

        app.get('/manage-services/:uid', async (req, res) => {
            const uid = req.params.uid
            const query = { providerUid: uid };
            const result = await serviceColl.find(query).toArray()
            res.send(result)
        })

        app.get('/services-todo/:uid', verifyToken, verifyUser, async (req, res) => {
            let sort = { _id: -1 }
            const uid = req.params.uid
            const query = { 'serviceData.providerUid': uid };
            const result = await bookingColl.find(query).sort(sort).toArray()
            res.send(result)
        })

        app.get('/services/marquee', async (req, res) => {
            const result = await marqueeColl.find().toArray()
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userColl.insertOne(user)
            res.send(result)
        })

        app.post('/add-service', async (req, res) => {
            const doc = req.body;
            // console.log(doc)
            const result = await serviceColl.insertOne(doc)
            res.send(result)
        })

        app.post('/book-service', async (req, res) => {
            const doc = req.body;
            const result = await bookingColl.insertOne(doc)
            res.send(result)
        })

        app.put('/services/put/:id', async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            const options = { upsert: true };
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { ...updatedData }
            }
            const result = await serviceColl.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        app.delete('/services/delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await serviceColl.deleteOne(query)
            res.send(result)
        })

        app.patch('/services-todo/:id', async (req, res) => {
            const id = req.params.id
            const doc = req.body;
            const options = { upsert: true };
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...doc
                }
            }
            const result = await bookingColl.updateOne(filter, updateDoc)
            res.send(result)
        })


        // DEPLOY ER SOMOY MUST SORAI NITE HOBE
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close(); //
    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`Repair Ranger app listening on port ${port}`)
})