plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Dirección de la plataforma web (la entrega el flujo de GitHub o se pasa con -PsiteUrl=https://...)
val siteUrl: String = ((project.findProperty("siteUrl") as String?) ?: "").trim().trimEnd('/')
if (siteUrl.isEmpty() || !siteUrl.startsWith("https://")) {
    throw GradleException("Falta la dirección de la plataforma. Usa -PsiteUrl=https://tu-sitio.netlify.app (debe empezar por https://).")
}

// Firma: si existe un keystore propio (variables de entorno) se usa; si no, se firma con la llave de depuración,
// suficiente para instalar la app directamente en los celulares.
val keystoreFile: String? = System.getenv("KEYSTORE_FILE")
val hasKeystore = keystoreFile != null && file(keystoreFile).exists()

android {
    namespace = "com.mda.visuales"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.mda.visuales"
        minSdk = 26
        targetSdk = 34
        versionCode = (project.findProperty("versionCode") as String?)?.toIntOrNull() ?: 1
        versionName = "1.1"
        buildConfigField("String", "SITE_URL", "\"$siteUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        if (hasKeystore) {
            create("release") {
                storeFile = file(keystoreFile!!)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (hasKeystore) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
}
