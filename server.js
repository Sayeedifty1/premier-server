
const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

const port =  5000;


// ! Middleware
app.use(cors());
app.use(express.json());




// ! MongoDB Connection
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://premier_uni:WWUcPwWPuFKW0Wvp@cluster0.2ionwzy.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 50,
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect((err => {
            if (err) {
                console.log(err);
                return;
            }
        }));
        const usersCollection = client.db("premier").collection("Users");
        const newPrintCollection = client.db("premier").collection("newReg");
        const attCollection = client.db("premier").collection("attendance");
        const studentInfoCollection = client.db("premier").collection("studentInfo");

        // post string data in newPrintCollection only a string named newPrint
        app.post('/newReg', async (req, res) => {

            const newPrint = req.body;

            // Insert the data into the newPrintCollection
            const result = await newPrintCollection.insertOne(newPrint);

            if (result.insertedCount > 0) {
                // Data was inserted successfully
                res.send('Fingerprint insertion failed');
            } else {
                // Fingerprint insertion failed

                res.send('Fingerprint inserted successfully');
            }

        });


        // get data from newReg collection
        app.get('/newReg', async (req, res) => {
            const result = await newPrintCollection.find().toArray();
            res.send(result);
        });


        // Get the next serial number from the userCollection
        app.get('/next-serial', async (req, res) => {
            try {
                const result = await usersCollection.find({}, { projection: { fingerprint: 1 } }).toArray();

                if (result.length === 0) {
                    // If no data exists, start with serial number 1
                    res.json({ nextSerial: 1 });
                } else {
                    // Filter out non-numeric fingerprints, then sort in ascending order
                    const sortedFingerprints = result
                        .map(user => parseInt(user.fingerprint, 10))
                        .filter(fingerprint => !isNaN(fingerprint))
                        .sort((a, b) => a - b);

                    // Find the first available serial number
                    let nextSerial = 1;
                    for (const fingerprint of sortedFingerprints) {
                        if (fingerprint === nextSerial) {
                            nextSerial++;
                        }
                    }

                    res.json({ nextSerial });
                }
            } catch (error) {
                console.error('Error retrieving next serial:', error);
                res.status(500).json({ error: 'Failed to retrieve next serial' });
            }
        });


        // delete data from newReg collection
        app.delete("/newReg", async (req, res) => {
            try {
                const result = await newPrintCollection.deleteMany({});

                if (result.deletedCount > 0) {
                    res.json({ message: "NewPrint data deleted successfully" });
                } else {
                    res.status(404).json({ message: "No newPrint data found" });
                }
            } catch (error) {
                console.error("Error:", error);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });

        app.post('/users', async (req, res) => {
            const { name, email, category, password, fingerprint, courses, mobile, id } = req.body;

            console.log('Received request data:', req.body);

            if (!name || !email || !category || !password || !courses || !mobile || !id) {
                return res.status(400).json({ error: 'All fields are required, including courses' });
            }

            const user = { name, email, category, password, fingerprint, courses, mobile, id };

            try {
                const result = await usersCollection.insertOne(user);

                if (result.insertedCount > 0) {
                    console.log('User registered successfully');
                    res.status(200).json({ message: 'User registered successfully' });
                } else {
                    res.status(500).json({ error: 'Failed to register user' });
                }
            } catch (err) {
                console.error('Error inserting user into MongoDB:', err);
                res.status(500).json({ error: 'Failed to register user' });
            }
        });

        // Post attendanceData in attCollection
        app.post('/attendance', async (req, res) => {
            const attendanceData = req.body;
            console.log(attendanceData);

            try {
                const result = await attCollection.insertOne(attendanceData);
                if (result.acknowledged) {
                    res.status(201).json({ message: 'Attendance data successfully posted' });
                } else {
                    throw new Error('Insert operation failed');
                }
            } catch (err) {
                console.error('Error inserting attendance data into MongoDB:', err);
                res.status(500).json({ error: 'Failed to post attendance data' });
            }
        });

        // Post student attendance data in studentInfoCollection
        app.post('/student-att-data', async (req, res) => {
            try {
                console.log('Received request body:', req.body);
        
                const studentAttendanceData = req.body;
        
                if (!Array.isArray(studentAttendanceData) || studentAttendanceData.length === 0) {
                    return res.status(400).json({ error: 'Invalid or empty student attendance data provided' });
                }
        
                const courseName = studentAttendanceData[0].courseName;
        
                // Input validation: Ensure each object has necessary properties
                const isValidData = studentAttendanceData.every(item => (
                    item.courseName === courseName && item.name && item.id && /* Add other required properties */
                    typeof item.name === 'string' && typeof item.id === 'string' /* Add other type checks */
                ));
        
                if (!isValidData) {
                    return res.status(400).json({ error: 'Invalid student attendance data format' });
                }
        
                // Delete existing data for the course
                await studentInfoCollection.deleteMany({ courseName });
        
                // Insert new data
                const result = await studentInfoCollection.insertMany(studentAttendanceData);
        
                if (result.acknowledged) {
                    res.status(201).json({ message: 'Student attendance data successfully posted' });
                } else {
                    throw new Error('Insert operation failed');
                }
            } catch (err) {
                console.error('Error handling student attendance data:', err);
                res.status(500).json({ error: 'Failed to process student attendance data' });
            }
        });
        
        

        // get student attendance data from studentInfoCollection by id
        app.get('/get-student-att-data/:id', async (req, res) => {
            const studentId = req.params.id;

            try {
                const studentData = await studentInfoCollection.find({ id: studentId }).toArray();

                if (studentData.length === 0) {
                    res.status(404).json({ message: 'No student data found for this ID' });
                } else {
                    res.json(studentData);
                }
            } catch (err) {
                console.error('Error fetching student data from MongoDB:', err);
                res.status(500).json({ error: 'Failed to fetch student data' });
            }
        });

        // get all attendance data from attCollection
        app.get('/attendance/:course', async (req, res) => {
            const courseName = req.params.course;

            try {
                // Search for attendance data based on the course name
                const attendanceData = await attCollection.find({ course: courseName }).toArray();

                if (attendanceData.length === 0) {
                    return res.status(404).json({ error: 'Attendance data not found for the specified course' });
                }

                // Extract unique course names
                const uniqueCourses = [...new Set(attendanceData.map(data => data.course))];

                // Send the unique course names along with the matched attendance data
                res.status(200).json({ matchedData: attendanceData, uniqueCourses });
            } catch (error) {
                console.error('Error retrieving attendance data:', error);
                res.status(500).json({ error: 'Failed to retrieve attendance data' });
            }
        });

        // delete a user from database by id
        app.delete("/users/:id", async (req, res) => {
            try {
                const id = new ObjectId(req.params.id);
                const result = await usersCollection.deleteOne({ _id: id });

                if (result.deletedCount > 0) {
                    res.send(true);
                } else {
                    res.send(false);
                }
            } catch (error) {
                console.error("Error deleting user:", error);
                res.status(500).send("Failed to delete user");
            }
        });
        // edit user info by id , email, mobile, name
        app.post("/users/:id", async (req, res) => {
            try {
                const id = new ObjectId(req.params.id);
                const { name, email, mobile, courses } = req.body;
                const result = await usersCollection.updateOne(
                    { _id: id },
                    { $set: { name, email, mobile,courses } }
                );

                if (result.modifiedCount > 0) {
                    res.send(true);
                } else {
                    res.send(false);
                }
            } catch (error) {
                console.error("Error updating user:", error);
                res.status(500).send("Failed to update user");
            }
        });





        app.post('/authenticate', async (req, res) => {
            try {
                const { email, password } = req.body;

                if (!email || !password) {
                    return res.status(400).json({ error: 'Email and password are required' });
                }

                await client.connect();
                const db = client.db('premier');
                const usersCollection = db.collection('Users');

                const user = await usersCollection.findOne({ email, password });

                if (!user) {
                    console.log('Authentication failed for email:', email);
                    return res.status(401).json({ error: 'Authentication failed' });
                }

                console.log('Authentication successful for email:', email);
                res.status(200).json(user);

            } catch (error) {
                console.error('Error authenticating user:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            } finally {
                await client.close();
            }
        });


        // get all users from database
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        // get details by fingerprint
        app.post("/search-user", async (req, res) => {
            try {
                const { fingerprint } = req.body;

                // Search for a user with a matching fingerprint in the userCollection
                const user = await usersCollection.findOne({ fingerprint: fingerprint });

                if (user) {
                    const responseData = {
                        name: user.name,
                        category: user.category,
                        id: user.id,
                    };

                    if (user.category === "Teacher") {
                        responseData.courses = user.courses; // If the user is a teacher, add courses
                    }

                    res.json(responseData);
                } else {
                    res.status(404).json({ message: "User not found" });
                }
            } catch (error) {
                console.error("Error searching for user by fingerprint:", error);
                res.status(500).json({ message: "Fingerprint search failed" });
            }
        });


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
        console.log('never stops')
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Att. server is runningggggggggggggggg')
})

app.listen(port, () => {
    console.log(`server is running on port ${port}`)
})