const mongoose = require('mongoose');
const { Schema } = mongoose;

const HorasTrabajadasSchema = new Schema({
    idSemana: {
        type: String,
        ref: 'Semana',
        required: true
    },
    idProyecto: {
        type: String,
        ref: 'Proyecto',
        required: true
    },
    idEmpleado: {
        type: String,
        ref: 'Empleado',
        required: true
    },
    nombreProyecto: {
        type: String,
        required: true
    },
    nombreEmpleado:{
        type: String,
        required: true
    },
    horasTrabajadas:{
        type:Number,
        required:true
    },
    fecha: {
        type: Date,
        required: false
    },
    diaSemana:{
        type:String,
        required:true
    },
    sonHorasExtra:{
        type:Boolean,
        required:true
    },
    excepcion:{
        type:String,
        required:true,
    },
    horaCreacion:{
        type:Date,
        required:true,
        default:Date.now
    }


});




module.exports = mongoose.model('HorasTrabajadas',HorasTrabajadasSchema);


// Middleware para actualizar las nominas cada vez que se actualicen los campos

// ✅ Middleware para Alta (Creación)
HorasTrabajadasSchema.post('save', async function(doc) {
    console.log(`✔ Se agregó una nueva entrada: ${doc.idSemana} - ${doc.idEmpleado}`);
    const recalculadorDeNomina = require('../services/calculadorDeNominaService.js'); // <-- Importación dentro del middleware
    await recalculadorDeNomina.recalcularNomina(doc.idSemana, doc.idEmpleado);
});

// ✅ Middleware para Altas Múltiples
HorasTrabajadasSchema.post('insertMany', async function(docs) {
    console.log(`✔ Se agregaron ${docs.length} nuevas entradas.`);
    const recalculadorDeNomina = require('../services/calculadorDeNominaService.js');
    for (let doc of docs) {
        await recalculadorDeNomina.recalcularNomina(doc.idSemana, doc.idEmpleado);
    }
});

// ✅ Middleware para Edición (Actualización)
HorasTrabajadasSchema.post('findOneAndUpdate', async function(doc) {
    if (doc) {
        console.log(`✏ Se actualizó una entrada: ${doc.idSemana} - ${doc.idEmpleado}`);
        const recalculadorDeNomina = require('../services/calculadorDeNominaService.js');
        await recalculadorDeNomina.recalcularNomina(doc.idSemana, doc.idEmpleado);
    }
});

// ✅ Middleware para Eliminación (Un documento)
HorasTrabajadasSchema.pre('findOneAndDelete', async function(doc) {
    console.log("MIDDLEWARE FINDONE AND DELETE");
    if (doc) {
        console.log(`🗑 Se eliminó una entrada: ${doc.idSemana} - ${doc.idEmpleado}`);
        const recalculadorDeNomina = require('../services/calculadorDeNominaService.js');
        await recalculadorDeNomina.recalcularNomina(doc.idSemana, doc.idEmpleado);
    }
});
// ✅ **Middleware para Eliminaciones Múltiples**
// HorasTrabajadasSchema.post('deleteMany', async function(result) {
//     console.log(`🗑 Se eliminaron ${result.deletedCount} entradas.`);
//     // Opcionalmente, podrías ejecutar una actualización general si afecta a muchos empleados
//     for (let doc of docs) {
//         await recalculadorDeNomina.recalcularNomina(doc.idSemana,doc.idEmpleado);
//     }
// });
