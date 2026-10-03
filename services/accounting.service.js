"use strict";

const boom = require("@hapi/boom");
const { models, sequelize } = require("../libs/sequelize");
const { Op } = require("sequelize");

const DEFAULT_ACCOUNTS_SEED = [
  {
    "code": "10.00.00",
    "name": "ACTIVO",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.00.00",
    "name": "ACTIVO CIRCULANTE",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.01.00",
    "name": "CAJA",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.01.10",
    "name": "Caja",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.02.00",
    "name": "BANCOS",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.02.10",
    "name": "Mercado Pago",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.02.50",
    "name": "Banco Chile",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.02.60",
    "name": "Banco Estado",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.02.70",
    "name": "Banco Santander",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.03.00",
    "name": "DEPOSITOS A PLAZO",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.03.10",
    "name": "Depositos a Plazo",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.03.50",
    "name": "Fondos Mutuos",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.05.00",
    "name": "DEUDORES POR VENTA",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.05.10",
    "name": "Clientes",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": true,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.05.20",
    "name": "Clientes Boletas",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.06.00",
    "name": "DOCUMENTOS POR COBRAR",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.06.10",
    "name": "Cheques en Cartera",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.06.40",
    "name": "Cheques Protestados",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.06.50",
    "name": "Letras En Cartera",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.06.60",
    "name": "Letras En Cobranza",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.07.00",
    "name": "DEUDORES VARIOS",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.07.10",
    "name": "Deudores Varios",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.07.15",
    "name": "Deudores Incobrables",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.07.20",
    "name": "Cuenta Corriente del Personal",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.07.30",
    "name": "Anticipo Remuneraciones",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.07.35",
    "name": "Anticipo Proveedores",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.07.50",
    "name": "Fondo por Rendir",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.08.00",
    "name": "DOCUMENTOS Y CTAS. POR COBRAR EERR",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.08.10",
    "name": "Cuenta Corriente EERR",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "11.09.00",
    "name": "EXISTENCIAS",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.09.01",
    "name": "Materias Primas",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.09.02",
    "name": "Productos en Proceso",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.09.03",
    "name": "Productos Semielaborados",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.09.10",
    "name": "Productos Terminados",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.09.20",
    "name": "Insumos Medicos",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.09.30",
    "name": "Existencias en Consignación",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.09.40",
    "name": "Importaciones en Transito",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.10.00",
    "name": "IMPUESTOS",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.10.10",
    "name": "Iva Credito Fiscal",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.10.11",
    "name": "Otros Impuestos Recuperables",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.10.12",
    "name": "Otros Impuestos No Recuperables",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.10.15",
    "name": "PPM Mensuales",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.10.20",
    "name": "PPUA Anual",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.10.25",
    "name": "Credito Activo Fijo",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.10.30",
    "name": "Credito por Donaciones",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.10.35",
    "name": "Credito Sence",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.10.40",
    "name": "Impuestos Diferidos (C/P)",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.11.00",
    "name": "GASTOS PAGADOS ANTICIPADOS",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "11.11.10",
    "name": "Seguros Pagados por Adelantado",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "11.11.20",
    "name": "Arriendos Pagados por Adelantado",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.00.00",
    "name": "ACTIVO FIJO",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "12.01.00",
    "name": "ACTIVO FIJO FISICO",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "12.01.10",
    "name": "Terrenos",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.01.20",
    "name": "Construcciones y Obras Infraestructura",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.01.30",
    "name": "Maquinarias y Equipos",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.01.40",
    "name": "Muebles y Utiles",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.01.50",
    "name": "Vehiculos",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.01.90",
    "name": "Otros Activos Fijos",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.02.00",
    "name": "DEPRECIACION ACUMULADA",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "12.02.01",
    "name": "Dep Acum Otros A Fijo",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.02.20",
    "name": "Dep Acum Construcciones y Obras Infraestructura",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.02.30",
    "name": "Dep Acum Maquinarias y Equipos",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.02.40",
    "name": "Dep Acum Muebles y Utiles",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.02.50",
    "name": "Dep Acum Vehiculos",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.03.00",
    "name": "REVALORIZACION DEPRECIACION ACUMULADA",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "12.03.01",
    "name": "Rev Dep Acum Otros A Fijo",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.03.20",
    "name": "Rev Dep Acum Construcc y Obra Infr",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.03.30",
    "name": "Rev Dep Acum Maquinarias y Equipos",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.03.40",
    "name": "Rev Dep Acum Muebles y Utiles",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "12.03.50",
    "name": "Rev Dep Acum Vehiculos",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "13.00.00",
    "name": "OTROS ACTIVOS",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "13.01.00",
    "name": "INVERSIONES EN EERR",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "13.01.01",
    "name": "Inversiones en EERR",
    "type": "ACTIVO",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "20.00.00",
    "name": "PASIVO",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "21.00.00",
    "name": "PASIVO CIRCULANTE",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "21.01.00",
    "name": "OBLIGACIONES BANCOS C/P",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "21.01.10",
    "name": "Lineas de Credito Bancos",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.01.20",
    "name": "Tarjeta de Credito Santander",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.01.30",
    "name": "Intereses Diferidos C/P",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.01.40",
    "name": "Obligaciones Leasing C/P",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.07.00",
    "name": "CUENTAS POR PAGAR",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "21.07.10",
    "name": "Proveedores Nacionales",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "21.07.11",
    "name": "Proveedores Extranjeros",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "21.07.20",
    "name": "Facturas Por Recibir",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.07.30",
    "name": "Cuentas Corriente EERR",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.07.40",
    "name": "Documentos Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "21.07.50",
    "name": "Documentos Por Pagar Caducos",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "21.07.60",
    "name": "Factoring por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "21.10.00",
    "name": "PROVISIONES",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "21.10.10",
    "name": "Provision Vacaciones",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.10.12",
    "name": "Provision Impto a la Renta",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.10.14",
    "name": "Provision Indemnizaciones",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.10.16",
    "name": "Provision Bonos Anuales",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.10.18",
    "name": "Otros Acreedores arios",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.00",
    "name": "RETENCIONES",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "21.12.10",
    "name": "Remuneraciones Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.15",
    "name": "Honorarios Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "21.12.20",
    "name": "AFP Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.25",
    "name": "Isapre Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.30",
    "name": "I.N.P. Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.35",
    "name": "Mutual de Seguridad",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.40",
    "name": "C.C.A.F.",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.45",
    "name": "Fondo Cesantia Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.50",
    "name": "Otras Retenciones",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.55",
    "name": "Cotizaciones Previsionales Por pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.70",
    "name": "Finiquitos Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.73",
    "name": "Ex Caja Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.12.74",
    "name": "IPS Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.13.00",
    "name": "IMPUESTOS POR PAGAR",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "21.13.10",
    "name": "Iva Debito Fiscal",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.13.15",
    "name": "Impuesto Unico Trabajadores",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.13.20",
    "name": "Impuesto a la Renta",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.13.25",
    "name": "Impuestos Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.13.30",
    "name": "Retencion Impto 2da Categoria",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.13.35",
    "name": "P.P.M. Por Pagar",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.20.00",
    "name": "OBLIGACIONES L/P",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "21.20.10",
    "name": "Obligaciones Bancos L/P",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "21.20.15",
    "name": "Lineas de Crédito Bancos L/P",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "21.20.20",
    "name": "Intereses Diferidos L/P",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "21.20.30",
    "name": "Obligaciones Leasing L/P",
    "type": "PASIVO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "OPERACIONAL",
    "is_title": false
  },
  {
    "code": "24.00.00",
    "name": "PATRIMONIO",
    "type": "PATRIMONIO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "24.01.00",
    "name": "CAPITAL Y RESERVAS",
    "type": "PATRIMONIO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "24.01.01",
    "name": "Resultado Acumulado",
    "type": "PATRIMONIO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "24.01.10",
    "name": "Capital",
    "type": "PATRIMONIO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "24.01.20",
    "name": "Revalorizacion Capital",
    "type": "PATRIMONIO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "24.01.30",
    "name": "Resultado Acumulado",
    "type": "PATRIMONIO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "24.01.40",
    "name": "Resultado del Ejercicio",
    "type": "PATRIMONIO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "24.01.50",
    "name": "Dividendos Provisorios",
    "type": "PATRIMONIO",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "50.00.00",
    "name": "INGRESOS",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "51.00.00",
    "name": "INGRESOS OPERACIONALES",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "51.01.00",
    "name": "VENTAS",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "51.01.10",
    "name": "Venta de Productos",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "51.01.20",
    "name": "Venta de Servicios",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "51.01.30",
    "name": "Venta EERR",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "51.01.40",
    "name": "Otros Ingresos",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "51.01.50",
    "name": "Ventas",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "52.00.00",
    "name": "INGRESOS  FUERA DE EXPLOTACION",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "52.01.00",
    "name": "INGRESOS FUERA DE EXPLOTACION",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "52.01.10",
    "name": "Intereses Ganados",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "52.01.20",
    "name": "Mayor Valor Activo Fijo",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "52.01.30",
    "name": "Otros Ingresos Fuera Explotacion",
    "type": "INGRESOS",
    "nature": "ACREEDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "60.00.00",
    "name": "EGRESOS",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "61.00.00",
    "name": "EGRESOS OPERACIONALES",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "61.01.00",
    "name": "COSTO DE VENTA",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "61.01.01",
    "name": "Costo de Venta",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.01.02",
    "name": "Costos de Insumos",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.01.10",
    "name": "Costo de Venta Productos",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.01.20",
    "name": "Costo de Venta Servicios",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.00",
    "name": "GASTOS GENERALES",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "61.04.01",
    "name": "Comisiones Bancarias",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.02",
    "name": "Servicios Basicos",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.03",
    "name": "Comisiones en Ventas",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.04",
    "name": "Honorarios Profesionales",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.05",
    "name": "IT - Plataformas y Programas",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.06",
    "name": "Telefono e Internet",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.07",
    "name": "Transporte de residuos hospitalarios",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": true,
    "require_reference": true,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.08",
    "name": "Publicidad y Propaganda",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.10",
    "name": "Gastos de Administracion",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.20",
    "name": "Gastos en Personal",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.25",
    "name": "Gastos Comerciales",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.30",
    "name": "Gastos Generales",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "61.04.40",
    "name": "Depreciacion & Amortizacion",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "62.00.00",
    "name": "EGRESOS FUERA DE EXPLOTACION",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "62.01.00",
    "name": "EGRESOS FUERA DE EXPLOTACION",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "62.01.01",
    "name": "Intereses Bancarios",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "62.01.10",
    "name": "Gastos Financieros",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "62.01.30",
    "name": "Depreciacion Ejercicio A.Fijo",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "62.01.35",
    "name": "Costo por Bajas de A.Fijo",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "62.01.50",
    "name": "Provision de Vacaciones",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "62.01.60",
    "name": "Otros Gtos Fuera Explotacion",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "62.01.70",
    "name": "IVA No Recuperable",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "63.00.00",
    "name": "CORRECCION MONETARIA",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "63.01.00",
    "name": "CORRECCION MONETARIA",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "63.01.10",
    "name": "CM. Existencias",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "63.01.11",
    "name": "CM. Activo Fijo",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "63.02.00",
    "name": "DIFERENCIA DE CAMBIO",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "63.02.10",
    "name": "Diferencia de Cambio",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  },
  {
    "code": "64.00.00",
    "name": "IMPUESTO A LA RENTA",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "64.01.00",
    "name": "IMPUESTO A LA RENTA",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": true
  },
  {
    "code": "64.01.10",
    "name": "Impuesto a la Renta",
    "type": "GASTOS",
    "nature": "DEUDORA",
    "is_system": true,
    "require_rut": false,
    "require_reference": false,
    "is_auxiliary": false,
    "cash_flow_classification": "NONE",
    "is_title": false
  }
];

class AccountingService {
   // Asegura y puebla el plan de cuentas por defecto si está vacío
   async ensureDefaultPlan(entityId) {
      const count = await models.AccountingAccount.count({ where: { entity_id: entityId } });
      if (count > 0) {
         // Auto-corregir el nombre de la cuenta 2.9 para empresas existentes
         await models.AccountingAccount.update(
            { name: "Ret Impto 2da Categoria" },
            { where: { entity_id: entityId, code: "2.9" } }
         );
         return { created: 0 };
      }

      const records = DEFAULT_ACCOUNTS_SEED.map((acc) => ({
         ...acc,
         entity_id: entityId,
      }));

      await models.AccountingAccount.bulkCreate(records, { ignoreDuplicates: true });
      return { created: records.length };
   }

   // Listar cuentas contables de la entidad
   async listAccounts(entityId, { type, q } = {}) {
      await this.ensureDefaultPlan(entityId);

      const where = { entity_id: entityId, is_active: true };
      if (type) where.type = type;
      if (q) {
         where[Op.or] = [
            { code: { [Op.like]: `%${q}%` } },
            { name: { [Op.like]: `%${q}%` } },
         ];
      }

      return models.AccountingAccount.findAll({
         where,
         order: [["code", "ASC"]],
      });
   }

   // Crear cuenta contable
   async createAccount(entityId, payload) {
      const existing = await models.AccountingAccount.findOne({
         where: { entity_id: entityId, code: payload.code.trim() },
      });
      if (existing) {
         throw boom.conflict(`Ya existe una cuenta con el código ${payload.code}`);
      }

      return models.AccountingAccount.create({
         entity_id: entityId,
         code: payload.code.trim(),
         name: payload.name.trim(),
         type: payload.type,
         nature: payload.nature || (["ACTIVO", "COSTOS", "GASTOS"].includes(payload.type) ? "DEUDORA" : "ACREEDORA"),
         cost_center_requirement: payload.cost_center_requirement || "NONE",
         is_system: false,
         require_rut: Boolean(payload.require_rut),
         require_reference: Boolean(payload.require_reference),
         is_auxiliary: Boolean(payload.is_auxiliary),
         is_title: Boolean(payload.is_title),
         cash_flow_classification: payload.cash_flow_classification || "NONE",
      });
   }

   // Actualizar cuenta contable
   async updateAccount(entityId, id, payload) {
      const account = await models.AccountingAccount.findOne({
         where: { id, entity_id: entityId },
      });
      if (!account) throw boom.notFound("Cuenta contable no encontrada");

      if (payload.name) account.name = payload.name.trim();
      if (payload.type) account.type = payload.type;
      if (payload.nature) account.nature = payload.nature;
      if (payload.cost_center_requirement) account.cost_center_requirement = payload.cost_center_requirement;
      if (payload.require_rut !== undefined) account.require_rut = Boolean(payload.require_rut);
      if (payload.require_reference !== undefined) account.require_reference = Boolean(payload.require_reference);
      if (payload.is_auxiliary !== undefined) account.is_auxiliary = Boolean(payload.is_auxiliary);
      if (payload.is_title !== undefined) account.is_title = Boolean(payload.is_title);
      if (payload.cash_flow_classification !== undefined) account.cash_flow_classification = payload.cash_flow_classification;

      await account.save();
      return account;
   }

   // Eliminar cuenta contable
   async deleteAccount(entityId, id) {
      const account = await models.AccountingAccount.findOne({
         where: { id, entity_id: entityId },
      });
      if (!account) throw boom.notFound("Cuenta contable no encontrada");
      if (account.is_system) throw boom.badRequest("No se pueden eliminar cuentas del sistema");

      const inUseCount = await models.AccountingEntryItem.count({ where: { account_id: id } });
      if (inUseCount > 0) {
         throw boom.badRequest("No se puede eliminar la cuenta porque tiene asientos contables asociados");
      }

      await account.destroy();
      return { id };
   }

   // --- Reglas de Asignación por Proveedor/Cliente ---
   async listRules(entityId) {
      const rules = await models.AccountingRule.findAll({
         where: { entity_id: entityId },
         include: [{ model: models.AccountingAccount, as: "account" }],
         order: [["counterparty_rut", "ASC"]],
      });

      // Autocompletar la razón social desde los documentos si está vacía
      const rulesToEnhance = rules.filter(r => !r.counterparty_name && r.counterparty_rut);
      if (rulesToEnhance.length > 0) {
         const ruts = [...new Set(rulesToEnhance.map(r => r.counterparty_rut))];
         const docs = await models.EntitySiiDocument.findAll({
            where: { 
               entity_id: entityId, 
               counterparty_rut: { [Op.in]: ruts },
               counterparty_name: { [Op.not]: null, [Op.ne]: '' }
            },
            attributes: ['counterparty_rut', 'counterparty_name'],
            group: ['counterparty_rut', 'counterparty_name'],
            raw: true
         });
         
         const nameMap = {};
         for (const doc of docs) {
            if (!nameMap[doc.counterparty_rut]) {
               nameMap[doc.counterparty_rut] = doc.counterparty_name;
            }
         }

         for (const rule of rules) {
            if (!rule.counterparty_name && nameMap[rule.counterparty_rut]) {
               rule.setDataValue('counterparty_name', nameMap[rule.counterparty_rut]);
               rule.counterparty_name = nameMap[rule.counterparty_rut];
               
               // Opcional: guardarlo en BD para la próxima vez
               rule.save().catch(() => {});
            }
         }
      }

      return rules;
   }

   async upsertRule(entityId, { counterparty_rut, counterparty_name, account_id, cost_center }) {
      const rutClean = String(counterparty_rut).trim().toUpperCase();
      const account = await models.AccountingAccount.findOne({
         where: { id: account_id, entity_id: entityId },
      });
      if (!account) throw boom.notFound("Cuenta contable no existe para la entidad");

      const [rule, created] = await models.AccountingRule.findOrCreate({
         where: { entity_id: entityId, counterparty_rut: rutClean },
         defaults: {
            entity_id: entityId,
            counterparty_rut: rutClean,
            counterparty_name: counterparty_name?.trim() || null,
            account_id,
            cost_center: cost_center?.trim() || null,
         },
      });

      if (!created) {
         rule.account_id = account_id;
         if (counterparty_name) rule.counterparty_name = counterparty_name.trim();
         rule.cost_center = cost_center?.trim() || null;
         await rule.save();
      }

      return models.AccountingRule.findByPk(rule.id, {
         include: [{ model: models.AccountingAccount, as: "account" }],
      });
   }

   
   async searchCounterparty(rut) {
      const cleanRut = String(rut).trim().toUpperCase();
      
      // Check Rules first
      const rule = await models.AccountingRule.findOne({
         where: { counterparty_rut: cleanRut, counterparty_name: { [Op.ne]: null } },
         attributes: ['counterparty_name']
      });
      if (rule && rule.counterparty_name) return { name: rule.counterparty_name };

      // Check SII documents globally
      const doc = await models.EntitySiiDocument.findOne({
         where: { counterparty_rut: cleanRut, counterparty_name: { [Op.ne]: null } },
         attributes: ['counterparty_name']
      });
      if (doc && doc.counterparty_name) return { name: doc.counterparty_name };

      return { name: null };
   }

   async deleteRule(entityId, id) {
      const rule = await models.AccountingRule.findOne({
         where: { id, entity_id: entityId },
      });
      if (!rule) throw boom.notFound("Regla no encontrada");
      await rule.destroy();
      return { id };
   }

   async upsertBulkRules(entityId, { account_id, glosa, cost_center, ruts, replace_account = false }) {
      const account = await models.AccountingAccount.findOne({
         where: { id: account_id, entity_id: entityId },
      });
      if (!account) throw boom.notFound("Cuenta contable no existe para la entidad");

      if (!Array.isArray(ruts)) throw boom.badRequest("ruts debe ser un array");

      const t = await sequelize.transaction();
      try {
         const providedRuts = ruts.map(r => String(r.rut || r.counterparty_rut).trim().toUpperCase()).filter(r => r && r !== 'UNDEFINED');
         if (replace_account) {
            if (providedRuts.length > 0) {
               await models.AccountingRule.destroy({
                  where: { entity_id: entityId, account_id, counterparty_rut: { [Op.notIn]: providedRuts } },
                  transaction: t
               });
            } else {
               await models.AccountingRule.destroy({
                  where: { entity_id: entityId, account_id },
                  transaction: t
               });
            }
         }

         for (const item of ruts) {
            const rutClean = String(item.rut || item.counterparty_rut).trim().toUpperCase();
            if (!rutClean || rutClean === 'UNDEFINED') continue;
            const name = item.name || item.counterparty_name || null;

            const [rule, created] = await models.AccountingRule.findOrCreate({
               where: { entity_id: entityId, counterparty_rut: rutClean },
               defaults: {
                  entity_id: entityId,
                  counterparty_rut: rutClean,
                  counterparty_name: name?.trim() || null,
                  account_id,
                  cost_center: cost_center?.trim() || null,
               },
               transaction: t
            });

            if (!created) {
               rule.account_id = account_id;
               if (name) rule.counterparty_name = name.trim();
               rule.cost_center = cost_center?.trim() || null;
               await rule.save({ transaction: t });
            }
         }
         await t.commit();
      } catch (err) {
         await t.rollback();
         throw err;
      }

      return { success: true, count: ruts.length };
   }

   // --- Asientos Contables ---
   async createEntry(entityId, payload) {
      const { entry_date, concept, items = [], source_type = "MANUAL", source_id = null } = payload;

      if (!items || items.length < 2) {
         throw boom.badRequest("Un asiento contable debe tener al menos 2 movimientos (Debe y Haber)");
      }

      let totalDebit = 0;
      let totalCredit = 0;

      for (const it of items) {
         const d = Math.round((Number(it.debit) || 0) * 100) / 100;
         const c = Math.round((Number(it.credit) || 0) * 100) / 100;
         totalDebit += d;
         totalCredit += c;
      }

      totalDebit = Math.round(totalDebit * 100) / 100;
      totalCredit = Math.round(totalCredit * 100) / 100;

      if (Math.abs(totalDebit - totalCredit) > 0.05) {
         throw boom.badRequest(
            `El asiento no está cuadrado. Total Debe ($${totalDebit}) ≠ Total Haber ($${totalCredit})`
         );
      }

      const t = await sequelize.transaction();
      try {
         // Obtener el siguiente número de asiento correlativo para la entidad
         const maxEntry = await models.AccountingEntry.max("entry_number", {
            where: { entity_id: entityId },
            transaction: t,
         });
         const entryNumber = (maxEntry || 0) + 1;

         const entry = await models.AccountingEntry.create(
            {
               entity_id: entityId,
               entry_number: entryNumber,
               entry_date,
               concept: concept.trim(),
               source_type,
               source_id,
               status: "POSTED",
               total_debit: totalDebit,
               total_credit: totalCredit,
            },
            { transaction: t }
         );

         const itemRecords = items.map((it) => ({
            entry_id: entry.id,
            account_id: it.account_id,
            description: it.description?.trim() || null,
            debit: Math.round((Number(it.debit) || 0) * 100) / 100,
            credit: Math.round((Number(it.credit) || 0) * 100) / 100,
            counterparty_rut: it.counterparty_rut?.trim().toUpperCase() || null,
            counterparty_name: it.counterparty_name?.trim() || null,
            cost_center: it.cost_center?.trim() || null,
         }));

         await models.AccountingEntryItem.bulkCreate(itemRecords, { transaction: t });
         await t.commit();

         return this.getEntryById(entityId, entry.id);
      } catch (err) {
         await t.rollback();
         throw err;
      }
   }

   async listEntries(entityId, { month, from, to, source_type, status, q, page = 1, limit = 50 }) {
      const where = { entity_id: entityId };

      if (status) where.status = status;
      
      if (source_type === 'SII_HONORARY') {
         where.source_type = 'SII_PURCHASE';
         where.concept = { [Op.like]: '%Boleta de Honorarios%' };
      } else if (source_type === 'SII_PURCHASE') {
         where.source_type = 'SII_PURCHASE';
         where.concept = { [Op.notLike]: '%Boleta de Honorarios%' };
      } else if (source_type) {
         where.source_type = source_type;
      }

      if (month && /^\d{4}-\d{2}$/.test(month)) {
         const [y, m] = month.split("-").map(Number);
         const startDate = `${month}-01`;
         const lastDay = new Date(y, m, 0).getDate();
         const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
         where.entry_date = { [Op.between]: [startDate, endDate] };
      } else if (from || to) {
         where.entry_date = {};
         if (from) where.entry_date[Op.gte] = from;
         if (to) where.entry_date[Op.lte] = to;
      }

      if (q) {
         where[Op.or] = [
            { concept: { [Op.like]: `%${q}%` } },
            { entry_number: { [Op.like]: `%${q}%` } },
         ];
      }

      const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

      const { count, rows } = await models.AccountingEntry.findAndCountAll({
         where,
         include: [
            {
               model: models.AccountingEntryItem,
               as: "items",
               include: [{ model: models.AccountingAccount, as: "account", attributes: ["code", "name", "type"] }],
            },
         ],
         order: [
            ["entry_date", "DESC"],
            ["entry_number", "DESC"],
         ],
         limit: Number(limit),
         offset,
         distinct: true,
      });

      return {
         total: count,
         totalPages: Math.max(1, Math.ceil(count / Number(limit))),
         page: Number(page),
         limit: Number(limit),
         rows,
      };
   }

   async getEntryById(entityId, id) {
      const entry = await models.AccountingEntry.findOne({
         where: { id, entity_id: entityId },
         include: [
            {
               model: models.AccountingEntryItem,
               as: "items",
               include: [{ model: models.AccountingAccount, as: "account" }],
            },
         ],
      });
      if (!entry) throw boom.notFound("Asiento contable no encontrado");
      return entry;
   }

   async annulEntry(entityId, id) {
      const entry = await models.AccountingEntry.findOne({
         where: { id, entity_id: entityId },
      });
      if (!entry) throw boom.notFound("Asiento contable no encontrado");

      entry.status = "ANNULLED";
      await entry.save();
      return entry;
   }

   async clearAnnulledEntries(entityId) {
      // 1. Encontrar todos los asientos anulados
      const entries = await models.AccountingEntry.findAll({
         where: { entity_id: entityId, status: "ANNULLED" }
      });
      
      const ids = entries.map(e => e.id);
      if (ids.length === 0) return { deletedCount: 0 };

      // 2. Borrar primero los items (cascade puede estar configurado, pero mejor manual)
      await models.AccountingEntryItem.destroy({
         where: { entry_id: { [Op.in]: ids } }
      });

      // 3. Borrar los asientos
      const deletedCount = await models.AccountingEntry.destroy({
         where: { id: { [Op.in]: ids } }
      });

      return { deletedCount };
   }

   async deleteAllEntries(entityId) {
      // 1. Encontrar todos los asientos
      const entries = await models.AccountingEntry.findAll({
         where: { entity_id: entityId }
      });
      
      const ids = entries.map(e => e.id);
      if (ids.length === 0) return { deletedCount: 0 };

      // 2. Borrar items
      await models.AccountingEntryItem.destroy({
         where: { entry_id: { [Op.in]: ids } }
      });

      // 3. Borrar asientos
      const deletedCount = await models.AccountingEntry.destroy({
         where: { id: { [Op.in]: ids } }
      });

      return { deletedCount };
   }

   // --- Generación Automática de Asientos desde SII (Compras y Ventas) ---
   async generateSiiEntries(entityId, { month, from, to, docIds }) {
      await this.ensureDefaultPlan(entityId);

      // Cargar mapa de cuentas clave
      const allAccounts = await models.AccountingAccount.findAll({ where: { entity_id: entityId } });
      const accountByCode = new Map(allAccounts.map((a) => [a.code, a]));

      const ivaCredito = accountByCode.get("11.10.10") || allAccounts.find((a) => a.name.toLowerCase().includes("credito fiscal") || a.name.toLowerCase().includes("crédito fiscal"));
      const ivaDebito = accountByCode.get("21.13.10") || allAccounts.find((a) => a.name.toLowerCase().includes("debito fiscal") || a.name.toLowerCase().includes("débito fiscal"));
      const proveedores = accountByCode.get("21.07.10") || allAccounts.find((a) => a.name.toLowerCase().includes("proveedores"));
      const clientes = accountByCode.get("11.05.10") || allAccounts.find((a) => a.name.toLowerCase() === "clientes");
      const clientesBoletas = accountByCode.get("11.05.20") || allAccounts.find((a) => a.name.toLowerCase().includes("clientes boletas")) || clientes;
      const ventas = accountByCode.get("51.01.50") || allAccounts.find((a) => a.name.toLowerCase().includes("ventas"));
      const gastosDefault = accountByCode.get("61.04.30") || allAccounts.find((a) => a.type === "GASTOS");

      if (!ivaCredito || !ivaDebito || !proveedores || !clientes || !ventas || !gastosDefault) {
         throw boom.badRequest("No se encontraron todas las cuentas base para la generación automática.");
      }

      // Cargar reglas por proveedor/cliente
      const rules = await models.AccountingRule.findAll({ where: { entity_id: entityId } });
      const ruleMap = new Map(rules.map((r) => [r.counterparty_rut, r]));

      // Cargar documentos SII
      const whereDoc = { entity_id: entityId };
      if (docIds && Array.isArray(docIds) && docIds.length > 0) {
         whereDoc.id = { [Op.in]: docIds };
      } else if (month && /^\d{4}-\d{2}$/.test(month)) {
         const [y, m] = month.split("-").map(Number);
         whereDoc.period_year = y;
         whereDoc.period_month = m;
      } else if (from || to) {
         whereDoc.issue_date = {};
         if (from) whereDoc.issue_date[Op.gte] = from;
         if (to) whereDoc.issue_date[Op.lte] = to;
      }

      const docs = await models.EntitySiiDocument.findAll({ where: whereDoc });

      let createdCount = 0;
      let skippedCount = 0;

      const getDocOpType = (d) => {
         const op = d.operationType || d.operation_type;
         if (op) return String(op).toUpperCase();
         // Lógica de retrocompatibilidad
         if ([39, 41, 1001].includes(d.doc_type_code)) return "INCOME";
         if (d.doc_type_code === 1002) return "EXPENSE";
         if ([33, 34, 61].includes(d.doc_type_code)) {
            if (d.received_date || d.purchase_type) return "EXPENSE";
            return "INCOME";
         }
         return "EXPENSE";
      };

      for (const doc of docs) {
         const opType = getDocOpType(doc);
         const sourceType = opType === "INCOME" ? "SII_SALE" : "SII_PURCHASE";

         // Verificar si ya existe un asiento activo para este documento
         const existing = await models.AccountingEntry.findOne({
            where: { entity_id: entityId, source_type: sourceType, source_id: doc.id, status: "POSTED" },
         });
         if (existing) {
            skippedCount++;
            continue;
         }

         const rut = (doc.counterparty_rut || "").toUpperCase();
         const name = doc.counterparty_name || "";
         let total = Number(doc.total_amount || 0);
         let vat = Number(doc.amount_vat || 0);
         let net = Number(doc.amount_net || 0);
         const exempt = Number(doc.amount_exempt || 0);

         // Si es Afecta (Factura 33 o Boleta 39) y el SII no desglosó el IVA en la base
         if ([33, 39].includes(doc.doc_type_code) && vat === 0 && total > 0) {
            const brutoAfecto = total - exempt;
            if (brutoAfecto > 0) {
               net = Math.round(brutoAfecto / 1.19);
               vat = brutoAfecto - net;
            }
         }

         if (net === 0) net = total - vat;

         const isCreditNote = doc.doc_type_code === 61;
         let conceptPrefix = "";
         if (opType === "EXPENSE") {
            conceptPrefix = isCreditNote ? "NC Proveedor" : "Compra";
         } else {
            conceptPrefix = isCreditNote ? "NC Cliente" : "Venta";
         }

         if (opType === "EXPENSE") {
            if (doc.doc_type_code === 1002) {
               const honorariosGasto = accountByCode.get("61.04.04") || allAccounts.find((a) => a.name.toLowerCase().includes("honorarios profesionales")) || gastosDefault;
               const retencion = accountByCode.get("21.13.30") || allAccounts.find((a) => a.name.toLowerCase().includes("ret impto 2da categoria") || a.name.toLowerCase().includes("retenciones honorarios"));
               const honorariosPorPagar = accountByCode.get("21.12.15") || allAccounts.find((a) => a.name.toLowerCase().includes("honorarios por pagar"));
               
               if (!retencion || !honorariosPorPagar) {
                  throw boom.badRequest("No se encontraron las cuentas para Honorarios (Retención o por Pagar).");
               }

               const rule = ruleMap.get(rut);
               const costCenter = rule ? rule.cost_center : null;

               const concept = `Boleta de Honorarios Folio ${doc.folio || "-"} - ${name || rut}`;
               const items = [];

               const bruto = Number(doc.amount_net || doc.total_amount || 0);
               const retencionMonto = Number(doc.amount_tax_no_credit || 0);
               const liquido = bruto - retencionMonto;

               const glosaBHE = rule && rule.glosa ? rule.glosa : `BH Nro ${doc.folio || "-"} ${name || rut}`.trim();

               items.push({
                  account_id: honorariosGasto.id,
                  description: glosaBHE,
                  debit: bruto,
                  credit: 0,
                  counterparty_rut: rut,
                  counterparty_name: name,
                  cost_center: costCenter,
               });
               items.push({
                  account_id: retencion.id,
                  description: glosaBHE,
                  debit: 0,
                  credit: retencionMonto,
                  counterparty_rut: rut,
                  counterparty_name: name,
               });
               items.push({
                  account_id: honorariosPorPagar.id,
                  description: glosaBHE,
                  debit: 0,
                  credit: liquido,
                  counterparty_rut: rut,
                  counterparty_name: name,
               });

               await this.createEntry(entityId, {
                  entry_date: doc.issue_date,
                  concept,
                  source_type: sourceType,
                  source_id: doc.id,
                  items,
               });
               createdCount++;
               continue;
            }

            // COMPRA
            const rule = ruleMap.get(rut);
            const expenseAccountId = rule ? rule.account_id : gastosDefault.id;
            const costCenter = rule ? rule.cost_center : null;

            const concept = `${conceptPrefix} Folio ${doc.folio || "-"} - ${name || rut}`;
            const items = [];

            const docTypeName = Number(doc.doc_type_code) === 1002 ? 'BH' : 'Factura';
            const glosaCompra = `${docTypeName} ${name || rut} Folio ${doc.folio || "-"}`.trim();

            // Debe: Gasto/Activo (Neto o Total si exenta)
            items.push({
               account_id: expenseAccountId,
               description: glosaCompra,
               debit: vat > 0 ? net : total,
               credit: 0,
               counterparty_rut: rut,
               counterparty_name: name,
               cost_center: costCenter,
            });

            // Debe: IVA Crédito Fiscal (si aplica)
            if (vat > 0) {
               items.push({
                  account_id: ivaCredito.id,
                  description: glosaCompra,
                  debit: vat,
                  credit: 0,
                  counterparty_rut: rut,
                  counterparty_name: name,
               });
            }

            // Haber: Proveedores Nacionales (Total)
            items.push({
               account_id: proveedores.id,
               description: glosaCompra,
               debit: 0,
               credit: total,
               counterparty_rut: rut,
               counterparty_name: name,
            });

            if (isCreditNote) {
               items.forEach(i => { const t = i.debit; i.debit = i.credit; i.credit = t; });
            }

            await this.createEntry(entityId, {
               entry_date: doc.issue_date,
               concept,
               source_type: sourceType,
               source_id: doc.id,
               items,
            });
            createdCount++;
         } else {
            // VENTA
            const concept = `${conceptPrefix} Folio ${doc.folio || "-"} - ${name || rut || "Cliente"}`;
            const items = [];

            const isBoleta = [39, 41].includes(Number(doc.doc_type_code));
            const ctaCliente = isBoleta ? clientesBoletas : clientes;

            const docTypeName = isBoleta ? 'Boleta' : 'Factura';
            const glosaVenta = `${docTypeName} ${name || rut} Folio ${doc.folio || "-"}`.trim();

            // Debe: Clientes por Cobrar (Total)
            items.push({
               account_id: ctaCliente.id,
               description: glosaVenta,
               debit: total,
               credit: 0,
               counterparty_rut: rut,
               counterparty_name: name,
            });

            // Haber: Ingresos por Ventas (Neto o Total si exenta)
            items.push({
               account_id: ventas.id,
               description: glosaVenta,
               debit: 0,
               credit: vat > 0 ? net : total,
               counterparty_rut: rut,
               counterparty_name: name,
            });

            // Haber: IVA Débito Fiscal (si aplica)
            if (vat > 0) {
               items.push({
                  account_id: ivaDebito.id,
                  description: glosaVenta,
                  debit: 0,
                  credit: vat,
                  counterparty_rut: rut,
                  counterparty_name: name,
               });
            }

            if (isCreditNote) {
               items.forEach(i => { const t = i.debit; i.debit = i.credit; i.credit = t; });
            }

            await this.createEntry(entityId, {
               entry_date: doc.issue_date,
               concept,
               source_type: sourceType,
               source_id: doc.id,
               items,
            });
            createdCount++;
         }
      }
      
      // Retro-Sincronización: Generar asientos para conciliaciones bancarias pasadas
      const historicalRecons = await models.BankTransactionDocument.findAll({
         include: [
            { model: models.EntityBankTransaction, as: 'tx', where: { entity_id: entityId } },
            { model: models.EntitySiiDocument, as: 'doc', where: { entity_id: entityId } }
         ]
      });



      for (const recon of historicalRecons) {
         const bankTx = recon.tx;
         const doc = recon.doc;
         if (!bankTx || !doc) continue;

         const existingEntry = await models.AccountingEntry.findOne({
            where: { entity_id: entityId, source_type: 'BANK_MOVEMENT', source_id: bankTx.id, status: 'POSTED' }
         });
         
         if (!existingEntry) {
            const entityBankAcc = await models.EntityBankAccount.findByPk(bankTx.entity_bank_account_id);
            const bankName = entityBankAcc ? entityBankAcc.bank_name.toLowerCase() : '';
            let bankAcc = allAccounts.find(a => bankName && a.name.toLowerCase().includes(bankName));
            if (!bankAcc) {
               bankAcc = allAccounts.find(a => a.name.toLowerCase().includes('banco'));
            }
            if (bankAcc) {
            const rut = (doc.counterparty_rut || '').toUpperCase();
            // Prioridad: nombre del documento SII > nombre del banco (si está en descripción) > vacío
            const name = doc.counterparty_name || bankTx.description || '';
            const toApply = Number(recon.amount_applied || bankTx.amount);

            const opType = getDocOpType(doc);

            if (opType === 'EXPENSE') {
               const honorariosPorPagar = accountByCode.get("21.12.15") || allAccounts.find((a) => a.name.toLowerCase().includes("honorarios por pagar"));
               const isBHE = doc.doc_type_code === 1002;
               const payableAccount = (isBHE && honorariosPorPagar) ? honorariosPorPagar : proveedores;

               if (payableAccount) {
                  // Documento de Compra u Honorario
                  if (bankTx.type === 'expense') {
                     // Pago normal
                     const glosaPago = isBHE ? `Pago BH Nro ${doc.folio || '-'} ${name || rut}` : `Pago proveedor ${name || rut} Folio ${doc.folio || '-'}`;
                     await this.createEntry(entityId, {
                        entry_date: bankTx.issued_at || doc.issue_date,
                        concept: glosaPago,
                        source_type: 'BANK_MOVEMENT',
                        source_id: bankTx.id,
                        items: [
                           { account_id: payableAccount.id, description: glosaPago, debit: toApply, credit: 0, counterparty_rut: rut, counterparty_name: name },
                           { account_id: bankAcc.id, description: glosaPago, debit: 0, credit: toApply, counterparty_rut: rut, counterparty_name: name }
                        ]
                     });
                     createdCount++;
                  } else if (bankTx.type === 'income') {
                     // Reembolso de una compra/honorario
                     const glosaReembolso = isBHE ? `Reverso Pago BH Nro ${doc.folio || '-'} ${name || rut}` : `Reembolso Compra Folio ${doc.folio || '-'} - ${name || rut}`;
                     await this.createEntry(entityId, {
                        entry_date: bankTx.issued_at || doc.issue_date,
                        concept: glosaReembolso,
                        source_type: 'BANK_MOVEMENT',
                        source_id: bankTx.id,
                        items: [
                           { account_id: bankAcc.id, description: glosaReembolso, debit: toApply, credit: 0, counterparty_rut: rut, counterparty_name: name },
                           { account_id: payableAccount.id, description: glosaReembolso, debit: 0, credit: toApply, counterparty_rut: rut, counterparty_name: name }
                        ]
                     });
                     createdCount++;
                  }
               }
            } else if (opType === 'INCOME') {
               const isBoleta = [39, 41, '39', '41'].includes(doc.doc_type_code);
               const clientesBoletas = accountByCode.get("11.05.20") || allAccounts.find((a) => a.name.toLowerCase().includes("clientes boletas")) || clientes;
               const currentClientesAcc = isBoleta ? clientesBoletas : clientes;
               if (currentClientesAcc) {
                  // Documento de Venta
                  if (bankTx.type === 'income') {
                     // Cobro normal
                     const glosaCobro = `Cobro de Cliente ${name || rut || 'Cliente'} Folio ${doc.folio || '-'}`.trim();
                     await this.createEntry(entityId, {
                        entry_date: bankTx.issued_at || doc.issue_date,
                        concept: glosaCobro,
                        source_type: 'BANK_MOVEMENT',
                        source_id: bankTx.id,
                        items: [
                           { account_id: bankAcc.id, description: glosaCobro, debit: toApply, credit: 0, counterparty_rut: rut, counterparty_name: name },
                           { account_id: currentClientesAcc.id, description: glosaCobro, debit: 0, credit: toApply, counterparty_rut: rut, counterparty_name: name }
                        ]
                     });
                     createdCount++;
                  } else if (bankTx.type === 'expense') {
                     // Devolución a un cliente
                     const glosaDev = `Devolución a Cliente Folio ${doc.folio || '-'} - ${name || rut}`.trim();
                     await this.createEntry(entityId, {
                        entry_date: bankTx.issued_at || doc.issue_date,
                        concept: glosaDev,
                        source_type: 'BANK_MOVEMENT',
                        source_id: bankTx.id,
                        items: [
                           { account_id: currentClientesAcc.id, description: glosaDev, debit: toApply, credit: 0, counterparty_rut: rut, counterparty_name: name },
                           { account_id: bankAcc.id, description: glosaDev, debit: 0, credit: toApply, counterparty_rut: rut, counterparty_name: name }
                        ]
                     });
                     createdCount++;
                  }
               }
            }
         }
       }
      }

      return { createdCount, skippedCount, totalDocs: docs.length + historicalRecons.length };
   }

   // --- Control de Saldos por RUT (Clientes y Proveedores) ---
   async getRUTBalances(entityId, { type = "ALL", q } = {}) {
      await this.ensureDefaultPlan(entityId);

      const accounts = await models.AccountingAccount.findAll({ where: { entity_id: entityId } });
      const accountByCode = new Map(accounts.map((a) => [a.code, a]));

      const clientesAcc = accountByCode.get("1.1.6") || accounts.find((a) => a.name.toLowerCase() === "clientes por cobrar");
      const proveedoresAcc = accountByCode.get("2.1") || accounts.find((a) => a.name.toLowerCase() === "proveedores nacionales");

      const targetAccountIds = [];
      if ((type === "ALL" || type === "RECEIVABLE") && clientesAcc) targetAccountIds.push(clientesAcc.id);
      if ((type === "ALL" || type === "PAYABLE") && proveedoresAcc) targetAccountIds.push(proveedoresAcc.id);

      if (!targetAccountIds.length) return [];

      const items = await models.AccountingEntryItem.findAll({
         where: { account_id: { [Op.in]: targetAccountIds } },
         include: [
            {
               model: models.AccountingEntry,
               as: "entry",
               where: { entity_id: entityId, status: "POSTED" },
            },
            {
               model: models.AccountingAccount,
               as: "account",
            },
         ],
      });

      // Agrupar por RUT
      const map = new Map();

      for (const item of items) {
         const rut = item.counterparty_rut || "SIN_RUT";
         if (q && !rut.toLowerCase().includes(q.toLowerCase()) && !(item.counterparty_name || "").toLowerCase().includes(q.toLowerCase())) {
            continue;
         }

         if (!map.has(rut)) {
            map.set(rut, {
               rut,
               name: item.counterparty_name || "",
               account_type: item.account_id === clientesAcc?.id ? "CLIENTE" : "PROVEEDOR",
               total_debit: 0,
               total_credit: 0,
               balance: 0,
               document_count: 0,
               entries: [],
            });
         } else if (!map.get(rut).name && item.counterparty_name) {
            // Si ya existe en el mapa sin nombre, completarlo con el primero disponible
            map.get(rut).name = item.counterparty_name;
         }

         const rec = map.get(rut);
         rec.total_debit += Number(item.debit || 0);
         rec.total_credit += Number(item.credit || 0);
         rec.document_count += 1;
         rec.entries.push({
            id: item.id,
            date: item.entry?.entry_date,
            concept: item.entry?.concept || item.description,
            debit: Number(item.debit || 0),
            credit: Number(item.credit || 0)
         });
      }

      // Enriquecer nombres faltantes desde la tabla de documentos SII
      const rutsWithoutName = Array.from(map.entries())
         .filter(([, v]) => !v.name && v.rut !== "SIN_RUT")
         .map(([rut]) => rut);

      if (rutsWithoutName.length > 0) {
         const siiDocs = await models.EntitySiiDocument.findAll({
            where: {
               entity_id: entityId,
               counterparty_rut: { [Op.in]: rutsWithoutName },
               counterparty_name: { [Op.ne]: null },
            },
            attributes: ["counterparty_rut", "counterparty_name"],
            group: ["counterparty_rut", "counterparty_name"],
            limit: 200,
         });

         for (const doc of siiDocs) {
            const entry = map.get((doc.counterparty_rut || "").toUpperCase());
            if (entry && !entry.name && doc.counterparty_name) {
               entry.name = doc.counterparty_name;
            }
         }
      }

      const results = Array.from(map.values()).map((r) => {
         // Para Clientes (Deudora): Saldo = Debe - Haber (Pendiente por cobrar)
         // Para Proveedores (Acreedora): Saldo = Haber - Debe (Pendiente por pagar)
         if (r.account_type === "CLIENTE") {
            r.balance = r.total_debit - r.total_credit;
         } else {
            r.balance = r.total_credit - r.total_debit;
         }
         r.name = r.name || "Sin nombre";
         r.status = r.balance <= 0 ? "Pagado" : (r.balance < (r.account_type === "CLIENTE" ? r.total_debit : r.total_credit) ? "Parcial" : "Pendiente");
         return r;
      });

      // Aplicar filtro q también por nombre (ahora que tenemos nombres completos)
      const filtered = q
         ? results.filter(r =>
              r.rut.toLowerCase().includes(q.toLowerCase()) ||
              r.name.toLowerCase().includes(q.toLowerCase())
           )
         : results;

      return filtered.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
   }
}

module.exports = AccountingService;
