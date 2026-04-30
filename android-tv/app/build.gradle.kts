plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace   = "com.cfitv.tv"
    compileSdk  = 35

    defaultConfig {
        applicationId   = "com.cfitv.tv"
        minSdk          = 21   // Android 5.0 — TV requis minimum
        targetSdk       = 35
        versionCode     = 1
        versionName     = "1.0"
        buildConfigField(
            "String",
            "CFITV_TV_URL",
            "\"${providers.gradleProperty("cfitvTvUrl").getOrElse("http://10.0.2.2:3000/tv")}\"",
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions { jvmTarget = "11" }

    buildFeatures { buildConfig = true }
}

dependencies {
    implementation(libs.androidx.core.ktx)
}
