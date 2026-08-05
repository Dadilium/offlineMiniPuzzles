import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { adUnitIds } from '../config/ads';

/** Anchored adaptive banner for hub/menu screens. Reserves no layout space
 * until the ad actually loads, so a slow or failed load never leaves a gap
 * or shifts surrounding content. */
export default function AdBanner() {
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={loaded ? styles.slot : styles.collapsed}>
      <BannerAd
        unitId={adUnitIds.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center' },
  collapsed: { height: 0, overflow: 'hidden' },
});
