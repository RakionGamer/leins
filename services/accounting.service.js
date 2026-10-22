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

   
   // Autocompletado por RUT o razón social (contactos centralizados + reglas + documentos SII)
   async searchCounterparties(entityId, q, limit = 50) {
      const term = String(q || "").trim();
      const whereContact = { entity_id: entityId };

      if (term.length > 0) {
         const cleaned = term.replace(/[.\s-]/g, "");
         whereContact[Op.or] = [
            { name: { [Op.like]: `%${term}%` } },
            { rut: { [Op.like]: `%${term}%` } },
            { rut: { [Op.like]: `%${cleaned}%` } },
         ];
      }

      // 1. Consultar tabla centralizada EntityContact si existe
      let contacts = [];
      try {
         if (models.EntityContact) {
            contacts = await models.EntityContact.findAll({
               where: whereContact,
               attributes: ["rut", "name", "type"],
               order: [["name", "ASC"]],
               limit: Number(limit) || 50,
               raw: true,
            });
         }
      } catch (err) {
         // Silencioso por si aun no corre la migracion en este entorno
      }

      const map = new Map();
      for (const c of contacts) {
         const rut = String(c.rut || "").toUpperCase();
         if (!rut) continue;
         map.set(rut, { rut, name: c.name || null, type: c.type || "PROVEEDOR" });
      }

      // Si no hay suficientes o para enriquecer, consultar rules y docs si hubo término de búsqueda
      if (term.length >= 2 || map.size === 0) {
         const cleaned = term ? term.replace(/[.\s-]/g, "") : "";
         const like = term ? { [Op.like]: `%${term}%` } : null;
         const likeRut = cleaned ? { [Op.like]: `%${cleaned}%` } : null;

         const rulesWhere = { entity_id: entityId };
         const docsWhere = { entity_id: entityId, counterparty_rut: { [Op.not]: null } };

         if (term) {
            rulesWhere[Op.or] = [{ counterparty_rut: likeRut }, { counterparty_name: like }];
            docsWhere[Op.or] = [{ counterparty_rut: likeRut }, { counterparty_name: like }];
         }

         const [rules, docs] = await Promise.all([
            models.AccountingRule.findAll({
               where: rulesWhere,
               attributes: ["counterparty_rut", "counterparty_name"],
               limit: Number(limit) || 50,
               raw: true,
            }),
            models.EntitySiiDocument.findAll({
               where: docsWhere,
               attributes: ["counterparty_rut", "counterparty_name"],
               group: ["counterparty_rut", "counterparty_name"],
               limit: (Number(limit) || 50) * 2,
               raw: true,
            }),
         ]);

         for (const r of [...rules, ...docs]) {
            const rut = String(r.counterparty_rut || "").toUpperCase();
            if (!rut) continue;
            const prev = map.get(rut);
            if (!prev) {
               map.set(rut, { rut, name: r.counterparty_name || null, type: "PROVEEDOR" });
            } else if (!prev.name && r.counterparty_name) {
               prev.name = r.counterparty_name;
            }
         }
      }

      return [...map.values()].slice(0, Number(limit) || 50);
   }

   async searchCounterparty(rut) {
      const cleanRut = String(rut).trim().toUpperCase();
      
      // 1. Check Contact table first
      try {
         if (models.EntityContact) {
            const contact = await models.EntityContact.findOne({
               where: { rut: cleanRut, name: { [Op.ne]: null } },
               attributes: ['name', 'type']
            });
            if (contact && contact.name) return { name: contact.name, type: contact.type };
         }
      } catch (e) {}

      // 2. Check Rules
      const rule = await models.AccountingRule.findOne({
         where: { counterparty_rut: cleanRut, counterparty_name: { [Op.ne]: null } },
         attributes: ['counterparty_name']
      });
      if (rule && rule.counterparty_name) return { name: rule.counterparty_name, type: 'PROVEEDOR' };

      // 3. Check SII documents globally
      const doc = await models.EntitySiiDocument.findOne({
         where: { counterparty_rut: cleanRut, counterparty_name: { [Op.ne]: null } },
         attributes: ['counterparty_name']
      });
      if (doc && doc.counterparty_name) return { name: doc.counterparty_name, type: 'PROVEEDOR' };

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
                  glosa: glosa?.trim() || null,
                  cost_center: cost_center?.trim() || null,
               },
               transaction: t
            });

            if (!created) {
               rule.account_id = account_id;
               if (name) rule.counterparty_name = name.trim();
               rule.glosa = glosa?.trim() || null;
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

      // Validaciones de Atributos Contables
      const accountIds = items.map(it => it.account_id);
      const accounts = await models.AccountingAccount.findAll({
         where: { id: accountIds, entity_id: entityId }
      });
      const accountMap = new Map(accounts.map(a => [a.id, a]));

      for (const it of items) {
         const acc = accountMap.get(it.account_id);
         if (!acc) throw boom.badRequest(`La cuenta con ID ${it.account_id} no existe o no pertenece a esta entidad.`);
         if (!acc.is_active) throw boom.badRequest(`La cuenta '${acc.code} - ${acc.name}' está bloqueada y no acepta movimientos.`);
         if (acc.is_title) throw boom.badRequest(`No puedes contabilizar en la cuenta título '${acc.code} - ${acc.name}'.`);
         if (acc.require_rut && (!it.counterparty_rut || it.counterparty_rut.trim() === '')) {
            throw boom.badRequest(`La cuenta '${acc.code} - ${acc.name}' exige RUT de contraparte.`);
         }
         if (acc.require_reference && (!it.description || it.description.trim() === '')) {
            throw boom.badRequest(`La cuenta '${acc.code} - ${acc.name}' exige Documento Referencial (Glosa/Descripción).`);
         }
         if (acc.cost_center_requirement === 'REQUIRED' && (!it.cost_center || it.cost_center.trim() === '')) {
            throw boom.badRequest(`La cuenta '${acc.code} - ${acc.name}' exige un Centro de Costo.`);
         }
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

               const baseGlosaBHE = `BH Nro ${doc.folio || "-"} ${name || rut}`.trim(); const glosaBHE = rule && rule.glosa ? `${baseGlosaBHE} - ${rule.glosa.trim()}` : baseGlosaBHE;

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
            const baseGlosaCompra = `${docTypeName} ${name || rut} Folio ${doc.folio || "-"}`.trim(); const glosaCompra = rule && rule.glosa ? `${baseGlosaCompra} - ${rule.glosa.trim()}` : baseGlosaCompra;

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
            const rule = ruleMap.get(rut); const baseGlosaVenta = `${docTypeName} ${name || rut} Folio ${doc.folio || "-"}`.trim(); const glosaVenta = rule && rule.glosa ? `${baseGlosaVenta} - ${rule.glosa.trim()}` : baseGlosaVenta;

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

   // --- Estado de Resultados (Comparativo Mensual) ---
   static #MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

   async getIncomeStatement(entityId, { periodMode = 'quarter', year, month, from, to } = {}) {
      await this.ensureDefaultPlan(entityId);

      const now = new Date();
      let currentYear = Number(year) || now.getFullYear();
      let currentMonth = Number(month) || (now.getMonth() + 1);

      // Calcular lista de meses según periodMode
      const monthsList = [];
      let startDate;
      let endDate;

      if ((periodMode === 'range' || periodMode === 'custom_range') && from && to && /^\d{4}-\d{2}-\d{2}$/.test(String(from).trim()) && /^\d{4}-\d{2}-\d{2}$/.test(String(to).trim())) {
         const f = String(from).trim();
         const t = String(to).trim();
         startDate = f <= t ? f : t;
         endDate = f <= t ? t : f;

         const [yStart, mStart] = startDate.split('-').map(Number);
         const [yEnd, mEnd] = endDate.split('-').map(Number);

         let cur = new Date(yStart, mStart - 1, 1);
         const targetEnd = new Date(yEnd, mEnd - 1, 1);

         while (cur <= targetEnd) {
            const y = cur.getFullYear();
            const m = cur.getMonth() + 1;
            const mStr = String(m).padStart(2, '0');
            monthsList.push({
               key: `${y}-${mStr}`,
               year: y,
               month: m,
               label: `${AccountingService.#MONTH_NAMES[m - 1]} ${y}`
            });
            cur.setMonth(cur.getMonth() + 1);
         }
         currentYear = yEnd;
         currentMonth = mEnd;
      } else if (periodMode === 'current_month') {
         const mStr = String(currentMonth).padStart(2, '0');
         monthsList.push({
            key: `${currentYear}-${mStr}`,
            year: currentYear,
            month: currentMonth,
            label: `${AccountingService.#MONTH_NAMES[currentMonth - 1]} ${currentYear}`
         });
         startDate = `${currentYear}-${mStr}-01`;
         const lastDayOfEndMonth = new Date(currentYear, currentMonth, 0).getDate();
         endDate = `${currentYear}-${mStr}-${String(lastDayOfEndMonth).padStart(2, '0')}`;
      } else if (periodMode === 'year') {
         for (let m = 1; m <= 12; m++) {
            const mStr = String(m).padStart(2, '0');
            monthsList.push({
               key: `${currentYear}-${mStr}`,
               year: currentYear,
               month: m,
               label: `${AccountingService.#MONTH_NAMES[m - 1]} ${currentYear}`
            });
         }
         startDate = `${currentYear}-01-01`;
         endDate = `${currentYear}-12-31`;
      } else {
         const numMonths = periodMode === 'semester' ? 6 : 3;
         for (let i = numMonths - 1; i >= 0; i--) {
            const d = new Date(currentYear, currentMonth - 1 - i, 1);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const mStr = String(m).padStart(2, '0');
            monthsList.push({
               key: `${y}-${mStr}`,
               year: y,
               month: m,
               label: `${AccountingService.#MONTH_NAMES[m - 1]} ${y}`
            });
         }
         const startMonth = monthsList[0];
         const endMonth = monthsList[monthsList.length - 1];
         startDate = `${startMonth.year}-${String(startMonth.month).padStart(2, '0')}-01`;
         const lastDayOfEndMonth = new Date(endMonth.year, endMonth.month, 0).getDate();
         endDate = `${endMonth.year}-${String(endMonth.month).padStart(2, '0')}-${String(lastDayOfEndMonth).padStart(2, '0')}`;
      }

      // Cargar todas las cuentas contables de resultado
      const allAccounts = await models.AccountingAccount.findAll({
         where: {
            entity_id: entityId,
            is_active: true,
            type: { [Op.in]: ['INGRESOS', 'COSTOS', 'GASTOS'] }
         },
         order: [['code', 'ASC']]
      });

      const accountById = new Map(allAccounts.map(a => [a.id, a]));
      const accountByCode = new Map(allAccounts.map(a => [a.code, a]));

      // Cuentas predeterminadas
      const defaultSalesAccount = accountByCode.get('51.01.50') || allAccounts.find(a => a.type === 'INGRESOS') || { id: 0, code: '51.01.50', name: 'Ventas', type: 'INGRESOS' };
      const defaultCostAccount = accountByCode.get('61.01.01') || allAccounts.find(a => a.code.startsWith('61.01')) || { id: 0, code: '61.01.01', name: 'Costo de Venta', type: 'COSTOS' };
      const defaultHonoraryAccount = accountByCode.get('61.04.04') || allAccounts.find(a => a.name.toLowerCase().includes('honorarios')) || { id: 0, code: '61.04.04', name: 'Honorarios Profesionales', type: 'GASTOS' };
      const defaultExpenseAccount = accountByCode.get('61.04.30') || allAccounts.find(a => a.type === 'GASTOS') || { id: 0, code: '61.04.30', name: 'Otros Gastos Generales', type: 'GASTOS' };

      // Cargar reglas de proveedores
      const rules = await models.AccountingRule.findAll({ where: { entity_id: entityId } });
      const ruleMap = new Map(rules.map(r => [(r.counterparty_rut || '').toUpperCase(), r]));

      // Consultar documentos SII en el rango de fechas o periodos
      const periodConditions = monthsList.map(m => ({
         period_year: m.year,
         period_month: m.month
      }));

      const docs = await models.EntitySiiDocument.findAll({
         where: {
            entity_id: entityId,
            [Op.or]: [
               { issue_date: { [Op.between]: [startDate, endDate] } },
               { received_date: { [Op.between]: [startDate, endDate] } },
               ...periodConditions
            ]
         },
         attributes: [
            'id', 'doc_type_code', 'operationType', 'purchase_type', 'received_date',
            'period_year', 'period_month', 'folio', 'issue_date',
            'counterparty_rut', 'counterparty_name', 'total_amount', 'amount_net', 'amount_vat', 'amount_exempt'
         ],
         order: [['issue_date', 'ASC']]
      });

      const getDocOpType = (d) => {
         const rawOp = d.operationType ?? d.getDataValue?.('operationType') ?? d.operation_type;
         const op = String(rawOp || '').toUpperCase();
         if (['EXPENSE', 'COMPRA', 'COMPRAS'].includes(op)) return 'EXPENSE';
         if (['INCOME', 'VENTA', 'VENTAS'].includes(op)) return 'INCOME';
         if (Number(d.doc_type_code) === 1002) return 'EXPENSE';
         if ([39, 41, 1001].includes(Number(d.doc_type_code))) return 'INCOME';
         if ([33, 34, 61].includes(Number(d.doc_type_code))) {
            if (d.received_date || d.purchase_type) return 'EXPENSE';
            return 'INCOME';
         }
         return 'EXPENSE';
      };

      // Estructura de acumulación por cuenta: accountCode -> { account, monthlyAmounts: { 'YYYY-MM': number }, total: number }
      const accountMovements = new Map();

      const getOrCreateAccMov = (acc) => {
         if (!accountMovements.has(acc.code)) {
            const initialMonthly = {};
            monthsList.forEach(m => { initialMonthly[m.key] = 0; });
            accountMovements.set(acc.code, {
               id: acc.id,
               code: acc.code,
               name: acc.name,
               type: acc.type,
               is_title: Boolean(acc.is_title),
               monthlyAmounts: initialMonthly,
               total: 0
            });
         }
         return accountMovements.get(acc.code);
      };

      for (const d of docs) {
         const opType = getDocOpType(d);
         let mKey = null;

         // Prioridad para determinar el mes contable/tributario:
         // 1. Periodo tributario oficial (period_year y period_month)
         if (d.period_year && d.period_month) {
            const pKey = `${d.period_year}-${String(d.period_month).padStart(2, '0')}`;
            if (monthsList.some(m => m.key === pKey)) {
               mKey = pKey;
            }
         }
         // 2. Si es compra y tiene received_date
         if (!mKey && opType === 'EXPENSE' && d.received_date) {
            const recMonth = String(d.received_date || '').slice(0, 7);
            if (monthsList.some(m => m.key === recMonth)) {
               mKey = recMonth;
            }
         }
         // 3. Fecha de emision (issue_date)
         if (!mKey) {
            const issMonth = String(d.issue_date || '').slice(0, 7);
            if (monthsList.some(m => m.key === issMonth)) {
               mKey = issMonth;
            }
         }
         if (!mKey) continue;

         let total = Number(d.total_amount || 0);
         let vat = Number(d.amount_vat || 0);
         let net = Number(d.amount_net || 0);
         const exempt = Number(d.amount_exempt || 0);

         if ([33, 39].includes(d.doc_type_code) && vat === 0 && total > 0) {
            const afecto = total - exempt;
            if (afecto > 0) net = Math.round(afecto / 1.19);
         }
         if (net === 0) net = total - vat;

         const isCreditNote = d.doc_type_code === 61;
         const rut = (d.counterparty_rut || '').toUpperCase();

         let targetAcc;
         let amount = 0;

         if (d.doc_type_code === 1002) {
            // Boleta de Honorarios
            const rule = ruleMap.get(rut);
            targetAcc = (rule && accountById.get(rule.account_id)) || defaultHonoraryAccount;
            amount = Number(d.amount_net || d.total_amount || 0);
         } else if (opType === 'INCOME') {
            // Venta
            const rule = ruleMap.get(rut);
            targetAcc = (rule && accountById.get(rule.account_id)) || defaultSalesAccount;
            amount = isCreditNote ? -Math.abs(net) : Math.abs(net);
         } else {
            // Compra
            const rule = ruleMap.get(rut);
            if (rule && accountById.has(rule.account_id)) {
               targetAcc = accountById.get(rule.account_id);
            } else {
               targetAcc = defaultCostAccount;
            }
            amount = isCreditNote ? -Math.abs(net) : Math.abs(net);
         }

         if (targetAcc) {
            const entry = getOrCreateAccMov(targetAcc);
            entry.monthlyAmounts[mKey] = (entry.monthlyAmounts[mKey] || 0) + amount;
            entry.total += amount;
         }
      }

      // Clasificación jerárquica:
      // 1. Ingresos Operacionales (Cuentas tipo INGRESOS o código 51.*)
      // 2. Costo Directo de Ventas (Cuentas tipo COSTOS o código 61.01.* o nombre con costo)
      // 3. Gastos Operacionales / OPEX (Cuentas tipo GASTOS 61.02, 61.03, 61.04...)
      const ingresosAccounts = [];
      const costosAccounts = [];
      const gastosAccounts = [];

      for (const item of accountMovements.values()) {
         if (item.code.startsWith('51') || item.type === 'INGRESOS') {
            ingresosAccounts.push(item);
         } else if (item.code.startsWith('61.01') || item.type === 'COSTOS' || item.name.toLowerCase().includes('costo')) {
            costosAccounts.push(item);
         } else {
            gastosAccounts.push(item);
         }
      }

      // Ordenar cuentas por código
      ingresosAccounts.sort((a, b) => a.code.localeCompare(b.code));
      costosAccounts.sort((a, b) => a.code.localeCompare(b.code));
      gastosAccounts.sort((a, b) => a.code.localeCompare(b.code));

      // Calcular subtotales mensuales
      const calcGroupTotals = (accounts) => {
         const monthlyTotals = {};
         monthsList.forEach(m => {
            monthlyTotals[m.key] = accounts.reduce((sum, a) => sum + (a.monthlyAmounts[m.key] || 0), 0);
         });
         const accumulated = Object.values(monthlyTotals).reduce((sum, val) => sum + val, 0);
         return { monthlyTotals, accumulated };
      };

      const ingresosGroup = {
         key: 'ingresos',
         code: '1',
         label: '1. INGRESOS OPERACIONALES',
         accounts: ingresosAccounts,
         ...calcGroupTotals(ingresosAccounts)
      };

      const costosGroup = {
         key: 'costos',
         code: '2',
         label: '2. COSTO DIRECTO DE VENTAS',
         accounts: costosAccounts,
         ...calcGroupTotals(costosAccounts)
      };

      // Margen Bruto Operacional = Ingresos - Costos Directos
      const margenBrutoMonthly = {};
      const margenBrutoPcts = {};
      monthsList.forEach(m => {
         const ing = ingresosGroup.monthlyTotals[m.key] || 0;
         const cos = costosGroup.monthlyTotals[m.key] || 0;
         const mb = ing - cos;
         margenBrutoMonthly[m.key] = mb;
         margenBrutoPcts[m.key] = ing > 0 ? Math.round((mb / ing) * 1000) / 10 : 0;
      });
      const margenBrutoAcc = ingresosGroup.accumulated - costosGroup.accumulated;
      const margenBrutoAccPct = ingresosGroup.accumulated > 0 ? Math.round((margenBrutoAcc / ingresosGroup.accumulated) * 1000) / 10 : 0;

      const margenBrutoGroup = {
         key: 'margen_bruto',
         label: 'MARGEN BRUTO OPERACIONAL',
         isSubtotal: true,
         monthlyTotals: margenBrutoMonthly,
         accumulated: margenBrutoAcc,
         monthlyPcts: margenBrutoPcts,
         accumulatedPct: margenBrutoAccPct
      };

      const gastosGroup = {
         key: 'gastos',
         code: '3',
         label: '3. GASTOS OPERACIONALES (OPEX)',
         accounts: gastosAccounts,
         ...calcGroupTotals(gastosAccounts)
      };

      // Resultado Neto del Periodo (EBITDA) = Margen Bruto - Gastos OPEX
      const ebitdaMonthly = {};
      const ebitdaPcts = {};
      monthsList.forEach(m => {
         const mb = margenBrutoMonthly[m.key] || 0;
         const gas = gastosGroup.monthlyTotals[m.key] || 0;
         const ebitda = mb - gas;
         const ing = ingresosGroup.monthlyTotals[m.key] || 0;
         ebitdaMonthly[m.key] = ebitda;
         ebitdaPcts[m.key] = ing > 0 ? Math.round((ebitda / ing) * 1000) / 10 : 0;
      });
      const ebitdaAcc = margenBrutoAcc - gastosGroup.accumulated;
      const ebitdaAccPct = ingresosGroup.accumulated > 0 ? Math.round((ebitdaAcc / ingresosGroup.accumulated) * 1000) / 10 : 0;

      const ebitdaGroup = {
         key: 'ebitda',
         label: 'RESULTADO NETO DEL PERIODO (EBITDA)',
         isTotal: true,
         monthlyTotals: ebitdaMonthly,
         accumulated: ebitdaAcc,
         monthlyPcts: ebitdaPcts,
         accumulatedPct: ebitdaAccPct
      };

      return {
         ok: true,
         period: {
            mode: periodMode,
            year: currentYear,
            month: currentMonth,
            months: monthsList,
            startDate,
            endDate
         },
         kpis: {
            totalIngresos: ingresosGroup.accumulated,
            totalCostos: costosGroup.accumulated,
            margenBruto: margenBrutoAcc,
            margenBrutoPct: margenBrutoAccPct,
            totalGastos: gastosGroup.accumulated,
            ebitda: ebitdaAcc,
            ebitdaPct: ebitdaAccPct
         },
         structure: [
            ingresosGroup,
            costosGroup,
            margenBrutoGroup,
            gastosGroup,
            ebitdaGroup
         ]
      };
   }

   // --- Mayor Analítico Auxiliar (Drill-down de celdas) ---
   async getIncomeStatementDrilldown(entityId, { accountCode, groupKey, periodMonth, from, to, year, month } = {}) {
      if (!entityId) throw boom.badRequest('entityId es requerido');
      let startDate;
      let endDate;
      let monthLabel;
      let targetYear;
      let targetMonth;

      if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(String(from).trim()) && /^\d{4}-\d{2}-\d{2}$/.test(String(to).trim())) {
         const f = String(from).trim();
         const t = String(to).trim();
         startDate = f <= t ? f : t;
         endDate = f <= t ? t : f;
         monthLabel = `Rango ${startDate} al ${endDate}`;
      } else {
         targetYear = Number(year);
         targetMonth = Number(month);

         if (periodMonth && /^\d{4}-\d{2}$/.test(periodMonth)) {
            const [y, m] = periodMonth.split('-').map(Number);
            targetYear = y;
            targetMonth = m;
         }

         if (!targetYear || !targetMonth) {
            const now = new Date();
            targetYear = targetYear || now.getFullYear();
            targetMonth = targetMonth || (now.getMonth() + 1);
         }

         const mStr = String(targetMonth).padStart(2, '0');
         startDate = `${targetYear}-${mStr}-01`;
         const lastDay = new Date(targetYear, targetMonth, 0).getDate();
         endDate = `${targetYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;
         monthLabel = `${AccountingService.#MONTH_NAMES[targetMonth - 1]} ${targetYear}`;
      }
      // Cargar cuentas y reglas
      const allAccounts = await models.AccountingAccount.findAll({
         where: { entity_id: entityId, is_active: true }
      });
      const accountById = new Map(allAccounts.map(a => [a.id, a]));
      const accountByCode = new Map(allAccounts.map(a => [a.code, a]));

      const defaultSalesAccount = accountByCode.get('51.01.50') || allAccounts.find(a => a.type === 'INGRESOS') || { id: 0, code: '51.01.50', name: 'Ventas' };
      const defaultCostAccount = accountByCode.get('61.01.01') || allAccounts.find(a => a.code.startsWith('61.01')) || { id: 0, code: '61.01.01', name: 'Costo de Venta' };
      const defaultHonoraryAccount = accountByCode.get('61.04.04') || allAccounts.find(a => a.name.toLowerCase().includes('honorarios')) || { id: 0, code: '61.04.04', name: 'Honorarios Profesionales' };
      const defaultExpenseAccount = accountByCode.get('61.04.30') || allAccounts.find(a => a.type === 'GASTOS') || { id: 0, code: '61.04.30', name: 'Otros Gastos Generales' };

      const rules = await models.AccountingRule.findAll({ where: { entity_id: entityId } });
      const ruleMap = new Map(rules.map(r => [(r.counterparty_rut || '').toUpperCase(), r]));

      // Documentos del mes
      const docs = await models.EntitySiiDocument.findAll({
         where: {
            entity_id: entityId,
            [Op.or]: [
               { issue_date: { [Op.between]: [startDate, endDate] } },
               { received_date: { [Op.between]: [startDate, endDate] } },
               { period_year: targetYear, period_month: targetMonth }
            ]
         },
         attributes: [
            'id', 'doc_type_code', 'operationType', 'purchase_type', 'received_date',
            'period_year', 'period_month', 'folio', 'issue_date',
            'counterparty_rut', 'counterparty_name', 'total_amount', 'amount_net', 'amount_vat', 'amount_exempt'
         ],
         order: [['issue_date', 'ASC'], ['folio', 'ASC']]
      });

      const getDocOpType = (d) => {
         const rawOp = d.operationType ?? d.getDataValue?.('operationType') ?? d.operation_type;
         const op = String(rawOp || '').toUpperCase();
         if (['EXPENSE', 'COMPRA', 'COMPRAS'].includes(op)) return 'EXPENSE';
         if (['INCOME', 'VENTA', 'VENTAS'].includes(op)) return 'INCOME';
         if (Number(d.doc_type_code) === 1002) return 'EXPENSE';
         if ([39, 41, 1001].includes(Number(d.doc_type_code))) return 'INCOME';
         if ([33, 34, 61].includes(Number(d.doc_type_code))) {
            if (d.received_date || d.purchase_type) return 'EXPENSE';
            return 'INCOME';
         }
         return 'EXPENSE';
      };

      const docTypePrefix = (code) => {
         switch (Number(code)) {
            case 33: return 'F';
            case 34: return 'FE';
            case 39: return 'B';
            case 41: return 'BE';
            case 61: return 'NC';
            case 1002: return 'BH';
            default: return 'DOC';
         }
      };

      const docTypeLabel = (code) => {
         switch (Number(code)) {
            case 33: return 'Factura Electrónica';
            case 34: return 'Factura No Afecta o Exenta';
            case 39: return 'Boleta Electrónica';
            case 41: return 'Boleta Exenta';
            case 61: return 'Nota de Crédito';
            case 1002: return 'Boleta de Honorarios';
            default: return `Doc ${code}`;
         }
      };

      const matchedDocs = [];
      let totalNet = 0;

      let targetAccountName = accountCode ? (accountByCode.get(accountCode)?.name || accountCode) : '';
      if (!targetAccountName && groupKey) {
         if (groupKey === 'ingresos') targetAccountName = 'Ingresos Operacionales';
         else if (groupKey === 'costos') targetAccountName = 'Costo Directo de Ventas';
         else if (groupKey === 'gastos') targetAccountName = 'Gastos Operacionales (OPEX)';
      }

      const targetMonthKey = `${targetYear}-${mStr}`;

      for (const d of docs) {
         const opType = getDocOpType(d);

         let docMonth = null;
         if (d.period_year && d.period_month) {
            const pKey = `${d.period_year}-${String(d.period_month).padStart(2, '0')}`;
            if (pKey === targetMonthKey) docMonth = pKey;
         }
         if (!docMonth && opType === 'EXPENSE' && d.received_date) {
            const recMonth = String(d.received_date || '').slice(0, 7);
            if (recMonth === targetMonthKey) docMonth = recMonth;
         }
         if (!docMonth) {
            const issMonth = String(d.issue_date || '').slice(0, 7);
            if (issMonth === targetMonthKey) docMonth = issMonth;
         }
         if (docMonth !== targetMonthKey) continue;
         let total = Number(d.total_amount || 0);
         let vat = Number(d.amount_vat || 0);
         let net = Number(d.amount_net || 0);
         const exempt = Number(d.amount_exempt || 0);

         if ([33, 39].includes(d.doc_type_code) && vat === 0 && total > 0) {
            const afecto = total - exempt;
            if (afecto > 0) net = Math.round(afecto / 1.19);
         }
         if (net === 0) net = total - vat;

         const isCreditNote = d.doc_type_code === 61;
         const rut = (d.counterparty_rut || '').toUpperCase();

         let targetAcc;
         let amount = 0;

         if (d.doc_type_code === 1002) {
            const rule = ruleMap.get(rut);
            targetAcc = (rule && accountById.get(rule.account_id)) || defaultHonoraryAccount;
            amount = Number(d.amount_net || d.total_amount || 0);
         } else if (opType === 'INCOME') {
            const rule = ruleMap.get(rut);
            targetAcc = (rule && accountById.get(rule.account_id)) || defaultSalesAccount;
            amount = isCreditNote ? -Math.abs(net) : Math.abs(net);
         } else {
            const rule = ruleMap.get(rut);
            if (rule && accountById.has(rule.account_id)) {
               targetAcc = accountById.get(rule.account_id);
            } else {
               targetAcc = defaultCostAccount;
            }
            amount = isCreditNote ? -Math.abs(net) : Math.abs(net);
         }

         let isMatch = false;
         if (accountCode && targetAcc && targetAcc.code === accountCode) {
            isMatch = true;
         } else if (groupKey && targetAcc) {
            if (groupKey === 'ingresos' && (targetAcc.code.startsWith('51') || targetAcc.type === 'INGRESOS')) isMatch = true;
            else if (groupKey === 'costos' && (targetAcc.code.startsWith('61.01') || targetAcc.type === 'COSTOS')) isMatch = true;
            else if (groupKey === 'gastos' && (targetAcc.code.startsWith('61') || targetAcc.type === 'GASTOS') && !targetAcc.code.startsWith('61.01') && targetAcc.type !== 'COSTOS') isMatch = true;
         }

         if (isMatch) {
            // Formatear fecha DD-MM-YYYY
            const rawDate = String(d.issue_date || '').slice(0, 10);
            const [yPart, mPart, dPart] = rawDate.split('-');
            const formattedDate = (dPart && mPart && yPart) ? `${dPart}-${mPart}-${yPart}` : rawDate;

            matchedDocs.push({
               id: d.id,
               date: formattedDate,
               rawDate: d.issue_date,
               folio: d.folio,
               folio_display: `${docTypePrefix(d.doc_type_code)}-${d.folio || '-'}`,
               doc_type_code: d.doc_type_code,
               doc_type_label: docTypeLabel(d.doc_type_code),
               counterparty_rut: d.counterparty_rut || 'SIN RUT',
               counterparty_name: d.counterparty_name || '(Sin razón social)',
               amount_net: amount,
               amount_vat: vat,
               total_amount: total,
               account_code: targetAcc.code,
               account_name: targetAcc.name
            });
            totalNet += amount;
         }
      }

      return {
         ok: true,
         accountCode: accountCode || null,
         accountName: targetAccountName,
         groupKey: groupKey || null,
         monthKey: `${targetYear}-${mStr}`,
         monthLabel,
         totalNet,
         count: matchedDocs.length,
         documents: matchedDocs
      };
   }
}

module.exports = AccountingService;
