package com.cfitv.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.cfitv.tv.ui.SetupScreen
import com.cfitv.tv.ui.TvScreen
import com.cfitv.tv.ui.TvViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: TvViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                val uiState by viewModel.uiState.collectAsState()

                when (uiState.screen) {
                    TvViewModel.UiState.Screen.SETUP -> SetupScreen(
                        serverUrl             = uiState.serverUrl,
                        label                 = uiState.label,
                        stationNumber         = uiState.stationNumber,
                        isLandscape           = uiState.isLandscape,
                        screenType            = uiState.screenType,
                        isDiscovering         = uiState.isDiscovering,
                        isPairing             = uiState.isPairing,
                        pairingPin            = uiState.pairingPin,
                        pairingUrl            = uiState.pairingUrl,
                        connected             = uiState.connected,
                        onServerUrlChange     = viewModel::updateServerUrl,
                        onLabelChange         = viewModel::updateLabel,
                        onStationNumberChange = viewModel::updateStationNumber,
                        onOrientationChange   = viewModel::updateIsLandscape,
                        onScreenTypeChange    = viewModel::updateScreenType,
                        onStartPairing        = viewModel::startPairing,
                        onCancelPairing       = viewModel::cancelPairing,
                        onRetryDiscovery      = viewModel::startMdnsDiscovery,
                        onConnect             = viewModel::connect,
                    )
                    TvViewModel.UiState.Screen.DISPLAY -> TvScreen(
                        uiState      = uiState,
                        onDisconnect = viewModel::disconnect,
                    )
                }
            }
        }
    }
}
