/*
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License. 
*/

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;
using Microsoft.Phone.Controls;
using System.IO;
using System.Windows.Media.Imaging;
using System.Windows.Resources;


namespace CordovaWP8_2_8_01
{
    public partial class MainPage : PhoneApplicationPage
    {
        private string nav;

        // Constructor
        public MainPage()
        {
            InitializeComponent();
            this.CordovaView.Loaded += CordovaView_Loaded;
            this.CordovaView.CordovaBrowser.Navigating += CordovaView_Navigating;
            this.CordovaView.CordovaBrowser.Navigated += CordovaView_Navigated;
        }

        protected override void OnNavigatedTo(System.Windows.Navigation.NavigationEventArgs e)
        {
            String tempUri = System.Net.HttpUtility.UrlDecode(e.Uri.ToString());
            String lookFor = "/Protocol?encodedLaunchUri=";

            if (tempUri.StartsWith(lookFor))
            {
                string uriStr = tempUri.Substring(lookFor.Length);
                nav = uriStr.Replace("/?", "?");
                //this.CordovaView.CordovaBrowser.Navigate(new Uri(uriStr.Substring("a2p3.net:/".Length), UriKind.Relative));
                //this.CordovaView.CordovaBrowser.InvokeScript("eval", new string[] {"window.simpleCall();"});
                //this.CordovaView.CordovaBrowser.Navigate(new Uri("www/index.html", UriKind.RelativeOrAbsolute));
                //this.CordovaView.CordovaBrowser.InvokeScript("handleOpenURL", new string[] {"\"" + System.Net.HttpUtility.UrlEncode(uriStr) + "\""});
                //this.CordovaView.CordovaBrowser.InvokeScript("handleOpenURL", new string[] {"\"" + System.Net.HttpUtility.UrlEncode(uriStr) + "\""});
                //this.CordovaView.CordovaBrowser.InvokeScript("handleOpenURL", "\"" + System.Net.HttpUtility.UrlEncode(uriStr.Substring("a2p3.net:/".Length)) + "\"");
                //this.CordovaView.CordovaBrowser.InvokeScript("handleOpenURL", "a2p3.net://token?");
            }
            else
            {
                nav = "";
            }
        }

        private void CordovaView_Navigating(object sender, NavigatingEventArgs e)
        {
            //if (nav != "")
            //{
            //    CordovaView.CordovaBrowser.InvokeScript("eval", new string[] { "window.navigateToUrl = \"" + nav + "\";" });
            //    nav = "";
            //}
        }

        private void CordovaView_Navigated(object sender, System.Windows.Navigation.NavigationEventArgs e)
        {
            if (nav != "")
            {
                //object r = CordovaView.CordovaBrowser.InvokeScript("handleOpenURL", new string[] { "\"" + nav + "\"" });
                CordovaView.CordovaBrowser.InvokeScript("eval", new string[] { "window.navigateToUrl = \"" + nav + "\";" });
                //CordovaView.CordovaBrowser.Navigate(new Uri("www/index.html#" + nav, UriKind.RelativeOrAbsolute));
                nav = "";
            }
        }

        private void CordovaView_Loaded(object sender, RoutedEventArgs e)
        {
            LayoutRoot.Children.Remove(SplashImage);
            //this.CordovaView.Loaded -= CordovaView_Loaded;
            //// first time load will have an animation
            //Storyboard _storyBoard = new Storyboard();
            //DoubleAnimation animation = new DoubleAnimation()
            //{
            //    From = 0,
            //    Duration = TimeSpan.FromSeconds(0.6),
            //    To = 90
            //};
            //Storyboard.SetTarget(animation, SplashProjector);
            //Storyboard.SetTargetProperty(animation, new PropertyPath("RotationY"));
            //_storyBoard.Children.Add(animation);
            //_storyBoard.Begin();
            //_storyBoard.Completed += Splash_Completed;
        }

        void Splash_Completed(object sender, EventArgs e)
        {
            (sender as Storyboard).Completed -= Splash_Completed;
            LayoutRoot.Children.Remove(SplashImage);
        }
    }
}
